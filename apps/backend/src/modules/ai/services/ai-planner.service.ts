import OpenAI from 'openai';
import { logger } from '../../../infrastructure/logger/logger';
import { extractJsonFromLlmResponse } from '../../../shared/utils/json-extraction.util';
import { buildPlannerPrompt } from '../prompts/planner.prompt';
import { ContextBuilderService } from './context-builder.service';
import { MemoryMessage } from './conversation-memory.service';
import { toolRegistry } from './tool-registry.service';
import { toolDispatcher } from './tool-dispatcher.service';
import {
  ExecutionPlan,
  ExecutionAction,
  PlannerContext,
} from '../types/planner.types';

// ─── Valid action types (used for response validation) ────────────────────────

const VALID_ACTION_TYPES = new Set([
  'ADD_ITEM',
  'REMOVE_ITEM',
  'UPDATE_QUANTITY',
  'UPDATE_VARIANT',
  'SET_VARIANT',
  'CLEAR_CART',
  'VIEW_CART',
  'VIEW_MENU',
  'SEARCH_ITEM',
  'ASK_PRICE',
  'CHECKOUT',
  'CHECK_PAYMENT_STATUS',
  'REPEAT_LAST_ORDER',
  'ASK_KNOWLEDGE',
  'GREETING',
  'SMALL_TALK',
  'UNKNOWN',
]);

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * AiPlannerService — Phase 1 of the AI Operating System architecture.
 *
 * CONTRACT:
 *  - This service ONLY generates an Execution Plan.
 *  - It NEVER executes actions, modifies the cart, or calls repositories.
 *  - All business logic is left entirely to the downstream adapter (Phase 2).
 *  - It is isolated from the production message flow until the adapter is wired.
 *
 * ARCHITECTURE:
 *  Customer Message
 *    ↓ (buildContext)
 *  Business Context (restaurant, menu, cart, state)
 *    ↓ (buildPlannerPrompt)
 *  LLM System Prompt
 *    ↓ (call)
 *  Raw LLM Response
 *    ↓ (extractJsonFromLlmResponse)
 *  ExecutionPlan { actions[] }
 */
export class AiPlannerService {
  private readonly client: OpenAI;
  private readonly contextBuilder: ContextBuilderService;

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.contextBuilder = new ContextBuilderService();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Generates a structured Execution Plan from the customer's message.
   *
   * @param restaurantId   - Tenant ID
   * @param customerPhone  - Customer's phone number
   * @param customerMessage - Raw customer message (any language)
   * @returns ExecutionPlan with one or more ordered actions, or a fallback UNKNOWN plan.
   */
  public async plan(
    restaurantId: string,
    customerPhone: string,
    customerMessage: string,
  ): Promise<ExecutionPlan> {
    try {
      // Assemble full context via ContextBuilderService (memory + session + cart + restaurant)
      const builtContext = await this.contextBuilder.buildContext(restaurantId, customerPhone, customerMessage);
      const { plannerContext, conversationHistory, historyMessagesInjected, historyTokenEstimate } = builtContext;

      const systemPrompt = buildPlannerPrompt(plannerContext);

      // Log the three required observability fields
      logger.info(
        {
          historyMessagesInjected,
          historyTokenEstimate,
          plannerContextSize: systemPrompt.length,
        },
        'AiPlanner: context assembled',
      );

      let rawResponse = await this.callLlm(systemPrompt, customerMessage, conversationHistory, restaurantId, customerPhone);
      let plan = this.parsePlan(rawResponse, customerMessage);

      // Retry once if the plan is completely UNKNOWN
      if (plan.actions.every((a) => a.type === 'UNKNOWN')) {
        logger.info('AiPlanner: Plan was all UNKNOWN. Retrying once.');
        rawResponse = await this.callLlm(systemPrompt, customerMessage, conversationHistory, restaurantId, customerPhone);
        plan = this.parsePlan(rawResponse, customerMessage);
      }

      // POST-VALIDATION: Discard hallucinated informational actions if there is a clear mutation
      const hasMutation = plan.actions.some(a =>
        ['ADD_ITEM', 'REMOVE_ITEM', 'UPDATE_QUANTITY', 'UPDATE_VARIANT', 'CLEAR_CART', 'CHECKOUT'].includes(a.type)
      );

      if (hasMutation) {
        plan.actions = plan.actions.filter(a =>
          !['ASK_PRICE', 'VIEW_MENU', 'SEARCH_ITEM', 'SMALL_TALK', 'GREETING', 'UNKNOWN'].includes(a.type)
        );
      }

      if (plan.actions.length === 0) {
        return this.fallbackPlan();
      }

      logger.info(
        { restaurantId, customerPhone, customerMessage, plan },
        'AiPlanner: Execution plan generated',
      );

      return plan;
    } catch (error) {
      logger.error(
        { error, restaurantId, customerPhone, customerMessage },
        'AiPlanner: Failed to generate plan — returning UNKNOWN fallback',
      );
      return this.fallbackPlan();
    }
  }

  // ─── Context Builder (delegated to ContextBuilderService) ────────────────────

  // NOTE: The private buildContext method has been removed.
  // Context assembly is now fully delegated to ContextBuilderService.
  // AiPlannerService no longer holds any repository references.


  /**
   * Calls the LLM with system prompt, history, latest user message, and handles
   * iterative tool execution loops if requested.
   */
  private async callLlm(
    systemPrompt: string,
    customerMessage: string,
    conversationHistory: MemoryMessage[] = [],
    restaurantId?: string,
    customerPhone?: string,
  ): Promise<string> {
    const historyMessages = conversationHistory.map((m) => ({
      role: 'user' as const,
      content: m.message,
      ...(m.role === 'assistant' ? { role: 'assistant' as const } : {}),
    }));

    // Construct the messages payload
    const messages: any[] = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages,
      { role: 'user' as const, content: customerMessage },
    ];

    const schemas = toolRegistry.getToolDefinitions().map((def: any) => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.parameters,
      },
    }));

    let toolIterations = 0;
    let llmRounds = 0;
    const plannerToolCalls: any[] = [];
    const toolNamesUsed: string[] = [];
    let totalToolExecutionTime = 0;

    const maxIterations = 2;

    while (toolIterations <= maxIterations) {
      llmRounds++;
      const payload: any = {
        model: process.env.AI_PLANNER_MODEL || process.env.AI_MODEL || 'openai/gpt-4o-mini',
        temperature: 0,
        max_tokens: 500,
        messages,
      };

      if (schemas.length > 0) {
        payload.tools = schemas;
      }

      logger.debug({ model: payload.model, rounds: llmRounds }, 'AiPlanner: Sending request to LLM');
      const completion = await this.client.chat.completions.create(payload);
      const choice = completion.choices[0];
      const responseMessage = choice?.message;

      if (!responseMessage) {
        throw new Error('LLM returned an empty choice response.');
      }

      // Add assistant response to history/messages for tool sequence
      messages.push(responseMessage);

      const toolCalls = responseMessage.tool_calls;
      if (toolCalls && toolCalls.length > 0 && toolIterations < maxIterations && restaurantId && customerPhone) {
        toolIterations++;
        for (const toolCall of toolCalls as any[]) {
          const toolName = toolCall.function.name;
          toolNamesUsed.push(toolName);
          plannerToolCalls.push({
            id: toolCall.id,
            name: toolName,
            arguments: toolCall.function.arguments,
          });

          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            logger.warn({ rawArgs: toolCall.function.arguments }, 'AiPlanner: Failed to parse tool arguments');
          }

          const toolStart = Date.now();
          const execution = await toolDispatcher.dispatch(toolName, parsedArgs, {
            restaurantId,
            customerPhone,
          });
          const duration = Date.now() - toolStart;
          totalToolExecutionTime += duration;

          logger.info(
            { toolName, duration, success: execution.success },
            'AiPlanner: Tool executed in loop'
          );

          // Append tool response
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: execution.success ? JSON.stringify(execution.result) : JSON.stringify({ error: execution.error }),
          });
        }
        // Continue looping
        continue;
      }

      // If no tool calls or reached max tool iterations, complete loop and return content
      let content = responseMessage.content || '';
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Log the requested structured logs
      logger.info(
        {
          plannerToolCalls,
          toolNamesUsed,
          toolExecutionTime: totalToolExecutionTime,
          toolIterations,
          llmRounds,
        },
        'AiPlanner: Finished tool execution loop'
      );

      return content;
    }

    // Fallback content from last message if loop exits
    const lastMsg = messages[messages.length - 1];
    let finalContent = lastMsg?.content || '';
    finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    logger.info(
      {
        plannerToolCalls,
        toolNamesUsed,
        toolExecutionTime: totalToolExecutionTime,
        toolIterations,
        llmRounds,
      },
      'AiPlanner: Finished tool execution loop'
    );

    return finalContent;
  }

  // ─── Response Parser ─────────────────────────────────────────────────────────

  /**
   * Parses the raw LLM response into a validated ExecutionPlan.
   * Uses the shared extractJsonFromLlmResponse utility which handles
   * markdown fences, trailing text, and partial JSON gracefully.
   */
  private parsePlan(rawContent: string, customerMessage: string): ExecutionPlan {
    if (!rawContent || rawContent.trim() === '') {
      logger.warn(
        { customerMessage },
        'AiPlanner: Empty response — returning UNKNOWN plan',
      );
      return this.fallbackPlan();
    }

    const parsed = extractJsonFromLlmResponse<{ actions?: unknown[] }>(rawContent);

    if (!parsed || !Array.isArray(parsed.actions)) {
      logger.warn(
        { rawContent, customerMessage },
        'AiPlanner: Response did not contain valid actions array',
      );
      return this.fallbackPlan();
    }

    const validatedActions = this.validateActions(parsed.actions);

    if (validatedActions.length === 0) {
      logger.warn(
        { rawContent },
        'AiPlanner: No valid actions after validation — returning UNKNOWN',
      );
      return this.fallbackPlan();
    }

    return { actions: validatedActions };
  }

  /**
   * Validates each raw action object from the LLM against known action types.
   * Unknown or malformed actions are replaced with UNKNOWN rather than crashing.
   */
  private validateActions(rawActions: unknown[]): ExecutionAction[] {
    const result: ExecutionAction[] = [];

    for (const raw of rawActions) {
      if (!raw || typeof raw !== 'object') continue;

      const action = raw as Record<string, unknown>;
      const type = action['type'];

      if (typeof type !== 'string' || !VALID_ACTION_TYPES.has(type)) {
        logger.warn(
          { type, action },
          'AiPlanner: Unknown action type from LLM — skipping',
        );
        continue;
      }

      // Validate and coerce specific fields
      const validated = this.coerceAction(action, type as ExecutionAction['type']);
      if (validated) {
        result.push(validated);
      }
    }

    return result;
  }

  /**
   * Coerces a raw action object into a strongly typed ExecutionAction.
   * Returns null if the action is irrecoverably malformed.
   */
  private coerceAction(
    raw: Record<string, unknown>,
    type: ExecutionAction['type'],
  ): ExecutionAction | null {
    switch (type) {
      case 'ADD_ITEM': {
        const item = String(raw['item'] || '').trim();
        if (!item) return null;
        return {
          type: 'ADD_ITEM',
          item,
          variant: raw['variant'] ? String(raw['variant']).trim() : undefined,
          quantity: Math.max(1, Math.round(Number(raw['quantity']) || 1)),
        };
      }

      case 'REMOVE_ITEM': {
        const item = String(raw['item'] || '').trim();
        if (!item) return null;
        return {
          type: 'REMOVE_ITEM',
          item,
          variant: raw['variant'] ? String(raw['variant']).trim() : undefined,
        };
      }

      case 'UPDATE_QUANTITY': {
        const item = String(raw['item'] || '').trim();
        if (!item) return null;
        return {
          type: 'UPDATE_QUANTITY',
          item,
          quantity: Math.max(1, Math.round(Number(raw['quantity']) || 1)),
          delta: Boolean(raw['delta']),
        };
      }

      case 'UPDATE_VARIANT': {
        const from = String(raw['from'] || '').trim();
        const to = String(raw['to'] || '').trim();
        if (!from || !to) return null;
        return {
          type: 'UPDATE_VARIANT',
          item: raw['item'] ? String(raw['item']).trim() : undefined,
          from,
          to,
        };
      }

      case 'SET_VARIANT': {
        const item = String(raw['item'] || '').trim();
        const variant = String(raw['variant'] || '').trim();
        if (!item || !variant) return null;
        return { type: 'SET_VARIANT', item, variant };
      }

      case 'SEARCH_ITEM': {
        const query = String(raw['query'] || '').trim();
        if (!query) return null;
        return { type: 'SEARCH_ITEM', query };
      }

      case 'ASK_PRICE': {
        const item = String(raw['item'] || '').trim();
        if (!item) return null;
        return {
          type: 'ASK_PRICE',
          item,
          variant: raw['variant'] ? String(raw['variant']).trim() : undefined,
        };
      }

      case 'VIEW_MENU': {
        return {
          type: 'VIEW_MENU',
          category: raw['category'] ? String(raw['category']).trim() : undefined,
        };
      }

      case 'ASK_KNOWLEDGE': {
        const question = String(raw['question'] || '').trim();
        return { type: 'ASK_KNOWLEDGE', question };
      }

      case 'SMALL_TALK': {
        return {
          type: 'SMALL_TALK',
          topic: raw['topic'] ? String(raw['topic']).trim() : undefined,
        };
      }

      // Stateless actions — no payload needed
      case 'CLEAR_CART':
      case 'VIEW_CART':
      case 'CHECKOUT':
      case 'CHECK_PAYMENT_STATUS':
      case 'REPEAT_LAST_ORDER':
      case 'GREETING':
      case 'UNKNOWN':
        return { type } as ExecutionAction;

      default:
        return null;
    }
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────────

  private fallbackPlan(): ExecutionPlan {
    return { actions: [{ type: 'UNKNOWN' }] };
  }
}
