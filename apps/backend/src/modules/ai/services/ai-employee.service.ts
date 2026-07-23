import OpenAI from 'openai';
import { logger } from '../../../infrastructure/logger/logger';
import { conversationMemoryService } from './conversation-memory.service';
import { toolRegistry } from './tool-registry.service';
import { toolDispatcher } from './tool-dispatcher.service';
import { ContextBuilderService } from './context-builder.service';
import {
  workingMemoryProvider,
  WorkingMemory,
  ConversationStage,
} from './working-memory.service';

// ─── Telemetry shape ──────────────────────────────────────────────────────────
interface Telemetry {
  contextBuildTime: number;
  redisTime: number;
  dbTime: number;
  cacheHits: number;
  cacheMisses: number;
  llmTime: number;
  toolExecutionTime: number;
  promptTokens: number;
  completionTokens: number;
  workingMemoryHit: boolean;
  rollingSummaryUsed: boolean;
  fastPathUsed: boolean;
  fastPathIntent?: string;
  totalResponseTime: number;
  llmCalls: number;
  toolCount: number;
  toolNames: string[];
}

// ─── Fast-path: Variant aliases ───────────────────────────────────────────────
const VARIANT_ALIASES: Record<string, string> = {
  half: 'Half', full: 'Full', large: 'Large', medium: 'Medium',
  small: 'Small', regular: 'Regular',
  'half portion': 'Half', 'full portion': 'Full',
  'ek piece': 'Half', 'ek wala': 'Half',
};

function detectVariantReply(msg: string): string | null {
  return VARIANT_ALIASES[msg.trim().toLowerCase()] ?? null;
}

// ─── Fast-path: Yes / No confirmation ────────────────────────────────────────
const YES_SET = new Set([
  'yes', 'haan', 'ha', 'ok', 'okay', 'sure', 'bilkul', 'theek hai',
  'confirm', 'proceed', 'continue', 'order kar do',
]);
const NO_SET = new Set([
  'no', 'nahi', 'na', 'cancel', 'nope', 'ruk', 'stop', 'mat karo', 'band karo',
]);

function detectConfirmation(msg: string): 'yes' | 'no' | null {
  const n = msg.trim().toLowerCase();
  if (YES_SET.has(n)) return 'yes';
  if (NO_SET.has(n)) return 'no';
  return null;
}

// ─── Fast-path: Intent detection (deterministic only) ────────────────────────
type DeterministicIntent =
  | 'VIEW_CART' | 'VIEW_MENU' | 'CLEAR_CART' | 'CHECKOUT'
  | 'REPEAT_LAST_ITEM' | 'REMOVE_LAST_ITEM' | 'INCREASE_QTY' | 'DECREASE_QTY';

const INTENT_MAP: Array<[RegExp, DeterministicIntent]> = [
  [/^(cart|mera cart|meri cart|cart dikhao|kya hai cart mein|show cart)$/i, 'VIEW_CART'],
  [/^(menu|menu dikhao|menu dikhana|show menu|menu please)$/i, 'VIEW_MENU'],
  [/^(clear cart|cart khali karo|sab hata do|sab kuch hata do|start fresh|naya order)$/i, 'CLEAR_CART'],
  [/^(checkout|bill bana do|bill please|order karo|place order|order lagao|bill|pay karna hai)$/i, 'CHECKOUT'],
  [/^(ek aur|same|one more|wahi wala|same order|phir se|repeat|do aur|3 aur)$/i, 'REPEAT_LAST_ITEM'],
  [/^(wo hata do|remove that|hata do|last hata do|woh mat chahiye|remove last)$/i, 'REMOVE_LAST_ITEM'],
  [/^(ek aur badhao|ek aur add karo|increase|\+1|plus one|quantity badhao)$/i, 'INCREASE_QTY'],
  [/^(ek kam karo|reduce|decrease|\-1|minus one|quantity kam karo|thoda kam)$/i, 'DECREASE_QTY'],
];

function detectDeterministicIntent(msg: string): DeterministicIntent | null {
  for (const [re, intent] of INTENT_MAP) {
    if (re.test(msg.trim())) return intent;
  }
  return null;
}

// ─── Greeting detection ───────────────────────────────────────────────────────
const GREETING_SET = new Set([
  'hi', 'hello', 'hey', 'namaste', 'namaskar', 'start', 'ram ram', 'yo',
  'good morning', 'good evening', 'good afternoon', 'hanji', 'salam', 'howdy',
]);

function isGreeting(msg: string): boolean {
  return GREETING_SET.has(msg.trim().toLowerCase());
}

// ─── Stage inference ──────────────────────────────────────────────────────────
function inferStage(cartLength: number, sessionState: string): ConversationStage {
  if (['AWAITING_PAYMENT', 'PAYMENT_PENDING'].includes(sessionState)) return 'PAYMENT';
  if (['CHECKOUT', 'ORDER_CONFIRMED'].includes(sessionState)) return 'CHECKOUT';
  if (cartLength > 0) return 'ORDERING';
  return 'GREETING';
}

// ─── Rolling summary: only update on cart mutations ───────────────────────────
function buildRollingSummary(
  restaurantName: string,
  cart: Array<{ itemName: string; variantName?: string; quantity: number; unitPrice: number }>,
  stage: ConversationStage,
  prevSummary?: string,
): string {
  if (cart.length === 0) {
    return `Customer chatting at ${restaurantName}. Cart empty.`;
  }
  const items = cart
    .map((c) => `${c.quantity}x ${c.itemName}${c.variantName ? ` (${c.variantName})` : ''}`)
    .join(', ');
  const total = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const stageNote = stage === 'CHECKOUT' ? ' Proceeding to checkout.' : '';
  return `Cart: ${items}. Total: ₹${total}.${stageNote}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AiEmployeeService {
  private readonly client: OpenAI;
  private readonly contextBuilder: ContextBuilderService;

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.contextBuilder = new ContextBuilderService();
  }

  public async handleMessage(
    restaurantId: string,
    customerPhone: string,
    customerMessage: string,
  ): Promise<string> {
    const t: Telemetry = {
      contextBuildTime: 0, redisTime: 0, dbTime: 0,
      cacheHits: 0, cacheMisses: 0, llmTime: 0, toolExecutionTime: 0,
      promptTokens: 0, completionTokens: 0,
      workingMemoryHit: false, rollingSummaryUsed: false,
      fastPathUsed: false, totalResponseTime: 0, llmCalls: 0,
      toolCount: 0, toolNames: [],
    };
    const handleStart = Date.now();

    try {
      logger.info({ restaurantId, customerPhone, customerMessage }, 'AiEmployee: incoming');

      // ── 1. Load Working Memory (async provider) ───────────────────────────
      const wmStart = Date.now();
      const wm = await workingMemoryProvider.get(restaurantId, customerPhone);
      t.redisTime += Date.now() - wmStart;
      t.workingMemoryHit = wm.updatedAt > 0 && wm.conversationStage !== 'GREETING';

      const msg = customerMessage.trim();

      // ── 2. FAST PATH: Pending Variant Reply ───────────────────────────────
      if (wm.pendingItem && wm.pendingQuestion) {
        const variantReply = detectVariantReply(msg);
        if (variantReply) {
          const reply = await this.handleVariantFastPath(
            restaurantId, customerPhone, msg, wm, variantReply, t,
          );
          if (reply) {
            t.fastPathUsed = true;
            t.fastPathIntent = 'VARIANT_REPLY';
            t.totalResponseTime = Date.now() - handleStart;
            this.logTelemetry(t);
            return reply;
          }
        }
      }

      // ── 3. FAST PATH: Confirmation (yes/no) ──────────────────────────────
      if (wm.pendingQuestion && wm.conversationStage === 'AWAITING_CONFIRMATION') {
        const confirm = detectConfirmation(msg);
        if (confirm !== null) {
          const reply = await this.handleConfirmationFastPath(
            restaurantId, customerPhone, msg, wm, confirm, t,
          );
          if (reply) {
            t.fastPathUsed = true;
            t.fastPathIntent = `CONFIRMATION_${confirm.toUpperCase()}`;
            t.totalResponseTime = Date.now() - handleStart;
            this.logTelemetry(t);
            return reply;
          }
        }
      }

      // ── 4. FAST PATH: Deterministic Intents ──────────────────────────────
      const detectedIntent = detectDeterministicIntent(msg);
      if (detectedIntent) {
        const reply = await this.handleDeterministicIntent(
          restaurantId, customerPhone, msg, wm, detectedIntent, t,
        );
        if (reply) {
          t.fastPathUsed = true;
          t.fastPathIntent = detectedIntent;
          t.totalResponseTime = Date.now() - handleStart;
          this.logTelemetry(t);
          return reply;
        }
      }

      // ── 5. Build Context ──────────────────────────────────────────────────
      const ctxStart = Date.now();
      const builtContext = await this.contextBuilder.buildContext(
        restaurantId, customerPhone, msg,
      );
      t.contextBuildTime = Date.now() - ctxStart;
      const { plannerContext, conversationHistory } = builtContext;

      // ── 6. Update stage in working memory ────────────────────────────────
      const stage = inferStage(plannerContext.cart.length, plannerContext.conversationState);
      const updatedWm = await workingMemoryProvider.update(restaurantId, customerPhone, {
        conversationStage: stage,
      });

      // ── 7. Determine if rolling summary can replace history ───────────────
      const hasSummary = Boolean(updatedWm.rollingSummary);
      const useHistory = !isGreeting(msg) && !hasSummary;
      t.rollingSummaryUsed = hasSummary;

      const historyMessages = useHistory
        ? conversationHistory.map((m) => ({ role: m.role, content: m.message }))
        : [];

      // ── 8. Build System Prompt ────────────────────────────────────────────
      const isCartEmpty = plannerContext.cart.length === 0;
      const systemPrompt = this.buildSystemPrompt(plannerContext, updatedWm, isCartEmpty);

      // ── 9. Assemble messages ──────────────────────────────────────────────
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: msg },
      ];

      // ── 10. Mutation-only tool schemas ────────────────────────────────────
      const allowedMutations = [
        'add_item_to_cart', 'remove_item_from_cart',
        'update_cart_quantity', 'clear_cart', 'checkout_cart',
      ];
      const schemas = toolRegistry.getToolDefinitions()
        .filter((def: any) => allowedMutations.includes(def.name))
        .map((def: any) => ({
          type: 'function' as const,
          function: { name: def.name, description: def.description, parameters: def.parameters },
        }));

      // ── 11. LLM: Single round — tools are NEVER called twice ───────────
      //
      // Max allowed flow: LLM call → tool execution → STOP (deterministic reply).
      // This prevents duplicate tool calls and hallucinated "error" replies after
      // a successful tool execution.
      t.llmCalls++;
      const llmPayload: any = {
        model: process.env.AI_EMPLOYEE_MODEL || process.env.AI_MODEL || 'openai/gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 450,
        messages,
      };
      if (schemas.length > 0) llmPayload.tools = schemas;

      logger.debug({ model: llmPayload.model }, 'AiEmployee: LLM call');

      const llmStart = Date.now();
      const completion = await this.client.chat.completions.create(llmPayload);
      t.llmTime += Date.now() - llmStart;

      if (completion.usage) {
        t.promptTokens     += completion.usage.prompt_tokens     || 0;
        t.completionTokens += completion.usage.completion_tokens || 0;
      }

      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) throw new Error('Empty LLM completion response.');

      const toolCalls = responseMessage.tool_calls;

      // ── 12. Tool execution (at most once) ─────────────────────────────
      if (toolCalls && toolCalls.length > 0) {
        t.toolCount += toolCalls.length;

        // UUID validation helper — prevents LLM from inventing non-UUID IDs
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUUID = (v: any) => typeof v === 'string' && UUID_RE.test(v);

        for (const toolCall of toolCalls as any[]) {
          const toolName = toolCall.function.name;
          t.toolNames.push(toolName);
          let parsedArgs: any = {};
          try { parsedArgs = JSON.parse(toolCall.function.arguments || '{}'); }
          catch { logger.warn({ toolName }, 'AiEmployee: Failed to parse tool args'); }

          // ── UUID guard: reject args with hallucinated IDs ────────────
          if (['add_item_to_cart', 'remove_item_from_cart', 'update_cart_quantity'].includes(toolName)) {
            if (parsedArgs.menuItemId && !isUUID(parsedArgs.menuItemId)) {
              logger.warn({ toolName, menuItemId: parsedArgs.menuItemId }, 'AiEmployee: Non-UUID menuItemId rejected — LLM hallucinated ID');
              const safeReply = 'I need a moment — could you clarify which item you meant? (e.g. "Paneer Tikka Full")';
              await this.saveMessages(restaurantId, customerPhone, msg, safeReply);
              t.totalResponseTime = Date.now() - handleStart;
              this.logTelemetry(t);
              return safeReply;
            }
            if (parsedArgs.variantId && !isUUID(parsedArgs.variantId)) {
              logger.warn({ toolName, variantId: parsedArgs.variantId }, 'AiEmployee: Non-UUID variantId rejected — LLM hallucinated ID');
              const safeReply = 'Which size would you like — Half or Full?';
              await this.saveMessages(restaurantId, customerPhone, msg, safeReply);
              t.totalResponseTime = Date.now() - handleStart;
              this.logTelemetry(t);
              return safeReply;
            }
          }

          const toolStart = Date.now();
          const execution = await toolDispatcher.dispatch(toolName, parsedArgs, {
            restaurantId, customerPhone,
          });
          t.toolExecutionTime += Date.now() - toolStart;

          logger.info({
            toolName, success: execution.success,
            durationMs: Date.now() - toolStart,
          }, 'AiEmployee: Tool executed');

          if (execution.success) {
            await this.postToolUpdate(
              restaurantId, customerPhone, toolName, parsedArgs, execution.result,
              plannerContext,
            );

            // ── Deterministic reply from tool result ─────────────────
            // NEVER re-ask LLM after a successful cart mutation.
            // Build the reply directly from the tool result to prevent hallucinated errors.
            const deterministicReply = this.buildDeterministicReply(toolName, execution.result, parsedArgs, updatedWm);
            if (deterministicReply) {
              await this.saveMessages(restaurantId, customerPhone, msg, deterministicReply);
              t.fastPathUsed = true;
              t.fastPathIntent = `TOOL_${toolName.toUpperCase()}`;
              t.totalResponseTime = Date.now() - handleStart;
              this.logTelemetry(t);
              return deterministicReply;
            }
          } else {
            // Tool failed — return graceful error, don't re-invoke LLM
            logger.error({ toolName, error: execution.error }, 'AiEmployee: Tool execution failed');
            const errReply = 'Sorry, I had trouble with that. Please try again.';
            await this.saveMessages(restaurantId, customerPhone, msg, errReply);
            t.totalResponseTime = Date.now() - handleStart;
            this.logTelemetry(t);
            return errReply;
          }
        }
      }

      // ── 13. Final Reply (no tools called — pure conversation) ─────────
      let content = responseMessage.content || '';
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Detect pending variant question from the reply
      if (/half|full|variant|size|portion/i.test(content) && t.toolCount === 0) {
        if (updatedWm.lastReferencedItem) {
          await workingMemoryProvider.update(restaurantId, customerPhone, {
            pendingItem: updatedWm.lastReferencedItem,
            pendingQuestion: content,
            conversationStage: 'AWAITING_VARIANT',
          });
        }
      }

      // Save messages fire-and-forget (non-blocking)
      this.saveMessages(restaurantId, customerPhone, msg, content).catch((err) =>
        logger.warn({ err }, 'AiEmployee: failed to save messages'),
      );

      t.totalResponseTime = Date.now() - handleStart;
      this.logTelemetry(t);
      return content || 'Something went wrong. Please try again.';

    } catch (error) {
      t.totalResponseTime = Date.now() - handleStart;
      logger.error({ error, totalResponseTime: t.totalResponseTime }, 'AiEmployee: Fatal error');
      return 'I encountered a technical issue. Please try again.';
    }
  }

  // ─── Deterministic Reply Builder ─────────────────────────────────────────────
  //
  // Returns a human-friendly reply string based purely on the tool's result object.
  // Called after every successful tool execution to avoid re-invoking LLM.
  //
  private buildDeterministicReply(
    toolName: string,
    result: any,
    args: any,
    wm: WorkingMemory,
  ): string | null {
    switch (toolName) {
      case 'add_item_to_cart': {
        const name = result?.displayName || result?.itemName || wm.lastReferencedItem || 'item';
        const qty = args?.quantity || 1;
        const price = result?.unitPrice || result?.price;
        const priceStr = price ? ` — ₹${price * qty}` : '';
        return `✅ Added ${qty}x *${name}* to your cart${priceStr}.\n\nReply *cart* to review or keep ordering! 🛒`;
      }
      case 'remove_item_from_cart': {
        const name = result?.displayName || result?.itemName || wm.lastReferencedItem || 'item';
        return `🗑️ Removed *${name}* from your cart.\n\nReply *cart* to review your order.`;
      }
      case 'update_cart_quantity': {
        const name = result?.displayName || result?.itemName || wm.lastReferencedItem || 'item';
        const qty = args?.quantity || result?.quantity;
        return qty
          ? `✏️ Updated *${name}* quantity to ${qty}.\n\nReply *cart* to review.`
          : `✅ Cart updated!`;
      }
      case 'clear_cart': {
        return '🧹 Cart cleared! Starting fresh — what would you like to order?';
      }
      case 'checkout_cart': {
        return result?.message || '🎉 Your order has been placed! Thank you!';
      }
      default:
        return null;
    }
  }

  // ─── Fast-path handlers ───────────────────────────────────────────────────

  private async handleVariantFastPath(
    restaurantId: string,
    customerPhone: string,
    msg: string,
    wm: WorkingMemory,
    variantReply: string,
    t: Telemetry,
  ): Promise<string | null> {
    logger.info({ pendingItem: wm.pendingItem, variantReply }, 'AiEmployee: FAST PATH — variant');

    const menuTool = toolRegistry.getTool('get_menu');
    const menuStart = Date.now();
    const menuData = menuTool
      ? await menuTool.execute(undefined, { restaurantId, customerPhone })
      : { menu: [] };
    t.toolExecutionTime += Date.now() - menuStart;

    const pendingLower = (wm.pendingItem || '').toLowerCase();
    const menuItem = (menuData.menu || []).find(
      (m: any) => m.name.toLowerCase().includes(pendingLower),
    );
    const variant = menuItem?.variants?.find(
      (v: any) => v.variantName.toLowerCase().includes(variantReply.toLowerCase()),
    );

    if (!menuItem || !variant) return null; // fall through to LLM

    const addStart = Date.now();
    const result = await toolDispatcher.dispatch('add_item_to_cart', {
      menuItemId: menuItem.id,
      quantity: 1,
      variantId: variant.id,
    }, { restaurantId, customerPhone });
    t.toolExecutionTime += Date.now() - addStart;
    t.toolCount++;
    t.toolNames.push('add_item_to_cart');

    if (!result.success) return null;

    await workingMemoryProvider.update(restaurantId, customerPhone, {
      lastReferencedItem: menuItem.name,
      lastReferencedVariant: variantReply,
      pendingItem: undefined,
      pendingQuestion: undefined,
      conversationStage: 'ORDERING',
      lastAction: 'add_item_to_cart',
      cartVersion: (wm.cartVersion || 0) + 1,
    });

    const reply = `Done! ${variantReply} ${menuItem.name} added to your cart 🛒`;
    await this.saveMessages(restaurantId, customerPhone, msg, reply);
    return reply;
  }

  private async handleConfirmationFastPath(
    restaurantId: string,
    customerPhone: string,
    msg: string,
    wm: WorkingMemory,
    confirm: 'yes' | 'no',
    t: Telemetry,
  ): Promise<string | null> {
    if (confirm === 'yes') {
      logger.info({}, 'AiEmployee: FAST PATH — checkout YES');
      const toolStart = Date.now();
      const result = await toolDispatcher.dispatch('checkout_cart', {}, { restaurantId, customerPhone });
      t.toolExecutionTime += Date.now() - toolStart;
      t.toolCount++;
      t.toolNames.push('checkout_cart');

      if (!result.success) return null;

      await workingMemoryProvider.update(restaurantId, customerPhone, {
        conversationStage: 'CHECKOUT',
        pendingQuestion: undefined,
        lastAction: 'checkout_cart',
      });
      const reply = result.result?.message || 'Your order has been placed! 🎉 Thank you!';
      await this.saveMessages(restaurantId, customerPhone, msg, reply);
      return reply;
    }

    if (confirm === 'no') {
      logger.info({}, 'AiEmployee: FAST PATH — confirmation NO');
      await workingMemoryProvider.update(restaurantId, customerPhone, {
        conversationStage: 'ORDERING',
        pendingQuestion: undefined,
      });
      const reply = "No problem! Your cart is still saved. Is there anything else you'd like to add or change?";
      await this.saveMessages(restaurantId, customerPhone, msg, reply);
      return reply;
    }

    return null;
  }

  private async handleDeterministicIntent(
    restaurantId: string,
    customerPhone: string,
    msg: string,
    wm: WorkingMemory,
    intent: string,
    t: Telemetry,
  ): Promise<string | null> {
    logger.info({ intent }, 'AiEmployee: FAST PATH — deterministic intent');
    t.toolCount++;

    switch (intent) {
      case 'VIEW_CART': {
        const cartTool = toolRegistry.getTool('get_cart');
        if (!cartTool) return null;
        const s = Date.now();
        const data = await cartTool.execute(undefined, { restaurantId, customerPhone });
        t.toolExecutionTime += Date.now() - s;
        t.toolNames.push('get_cart');
        if (!data?.items?.length) {
          const reply = 'Your cart is empty! What would you like to order?';
          await this.saveMessages(restaurantId, customerPhone, msg, reply);
          return reply;
        }
        const lines = data.items.map((i: any) => `• ${i.quantity}x ${i.name || i.menuItemId}`).join('\n');
        const reply = `Here's your cart:\n${lines}`;
        await this.saveMessages(restaurantId, customerPhone, msg, reply);
        return reply;
      }

      case 'VIEW_MENU': {
        // Let LLM handle so it can present the full menu naturally
        return null;
      }

      case 'CLEAR_CART': {
        const s = Date.now();
        const result = await toolDispatcher.dispatch('clear_cart', {}, { restaurantId, customerPhone });
        t.toolExecutionTime += Date.now() - s;
        t.toolNames.push('clear_cart');
        if (!result.success) return null;
        await workingMemoryProvider.reset(restaurantId, customerPhone);
        const reply = 'Cart cleared! Starting fresh — what would you like to order?';
        await this.saveMessages(restaurantId, customerPhone, msg, reply);
        return reply;
      }

      case 'CHECKOUT': {
        // If there is already a pending question (AI already asked for confirmation), skip
        if (wm.pendingQuestion) return null;
        // Otherwise let LLM handle checkout initiation naturally
        return null;
      }

      case 'REPEAT_LAST_ITEM': {
        if (!wm.lastReferencedItem) return null;
        // Let LLM handle "ek aur" so it can confirm naturally with the last variant
        return null;
      }

      case 'REMOVE_LAST_ITEM': {
        if (!wm.lastReferencedItem) return null;
        // Let LLM handle so it can identify the correct cart line
        return null;
      }

      case 'INCREASE_QTY':
      case 'DECREASE_QTY': {
        // Needs item identification — let LLM handle
        return null;
      }

      default:
        return null;
    }
  }

  // ─── Post-tool Working Memory Updates ────────────────────────────────────────

  private async postToolUpdate(
    restaurantId: string,
    customerPhone: string,
    toolName: string,
    args: any,
    result: any,
    context: any,
  ): Promise<void> {
    const wm = await workingMemoryProvider.get(restaurantId, customerPhone);

    switch (toolName) {
      case 'add_item_to_cart': {
        const displayName = result?.displayName || '';
        const variantName = result?.variantName || '';
        const newVersion = (wm.cartVersion || 0) + 1;
        const summary = buildRollingSummary(
          context.restaurantName, context.cart, 'ORDERING', wm.rollingSummary,
        );
        await workingMemoryProvider.update(restaurantId, customerPhone, {
          lastReferencedItem: displayName || wm.lastReferencedItem,
          lastReferencedVariant: variantName || undefined,
          pendingItem: undefined,
          pendingQuestion: undefined,
          conversationStage: 'ORDERING',
          lastAction: 'add_item_to_cart',
          cartVersion: newVersion,
          rollingSummary: summary,
        });
        break;
      }
      case 'remove_item_from_cart':
      case 'update_cart_quantity': {
        const newVersion = (wm.cartVersion || 0) + 1;
        const summary = buildRollingSummary(
          context.restaurantName, context.cart, 'ORDERING', wm.rollingSummary,
        );
        await workingMemoryProvider.update(restaurantId, customerPhone, {
          pendingItem: undefined,
          pendingQuestion: undefined,
          conversationStage: 'ORDERING',
          lastAction: toolName,
          cartVersion: newVersion,
          rollingSummary: summary,
        });
        break;
      }
      case 'clear_cart': {
        await workingMemoryProvider.reset(restaurantId, customerPhone);
        break;
      }
      case 'checkout_cart': {
        const summary = buildRollingSummary(
          context.restaurantName, context.cart, 'CHECKOUT', wm.rollingSummary,
        );
        await workingMemoryProvider.update(restaurantId, customerPhone, {
          conversationStage: 'CHECKOUT',
          pendingItem: undefined,
          pendingQuestion: undefined,
          lastAction: 'checkout_cart',
          rollingSummary: summary,
        });
        break;
      }
    }
  }

  // ─── Save messages (fire-and-forget) ─────────────────────────────────────────

  private async saveMessages(
    restaurantId: string,
    customerPhone: string,
    userMsg: string,
    assistantMsg: string,
  ): Promise<void> {
    await Promise.all([
      conversationMemoryService.saveMessage(restaurantId, customerPhone, 'user', userMsg),
      conversationMemoryService.saveMessage(restaurantId, customerPhone, 'assistant', assistantMsg),
    ]);
  }

  // ─── Telemetry logger ─────────────────────────────────────────────────────────

  private logTelemetry(t: Telemetry): void {
    logger.info({
      contextBuildTime: t.contextBuildTime,
      redisTime: t.redisTime,
      dbTime: t.dbTime,
      cacheHits: t.cacheHits,
      cacheMisses: t.cacheMisses,
      llmTime: t.llmTime,
      toolExecutionTime: t.toolExecutionTime,
      promptTokens: t.promptTokens,
      completionTokens: t.completionTokens,
      totalTokens: t.promptTokens + t.completionTokens,
      workingMemoryHit: t.workingMemoryHit,
      rollingSummaryUsed: t.rollingSummaryUsed,
      fastPathUsed: t.fastPathUsed,
      fastPathIntent: t.fastPathIntent,
      llmCalls: t.llmCalls,
      toolCount: t.toolCount,
      toolNames: t.toolNames,
      totalResponseTime: t.totalResponseTime,
    }, 'AiEmployee V2: Telemetry');
  }

  // ─── System Prompt ────────────────────────────────────────────────────────────

  private buildSystemPrompt(context: any, wm: WorkingMemory, isCartEmpty: boolean): string {
    // Cart block
    const cartTotal = context.cart.reduce(
      (s: number, c: any) => s + c.unitPrice * c.quantity, 0,
    );
    const cartLines = context.cart.length > 0
      ? context.cart.map((c: any) => {
          const v = c.variantName ? ` (${c.variantName})` : '';
          return `• ${c.quantity}x ${c.itemName}${v} ₹${c.unitPrice * c.quantity}`;
        }).join('\n') + `\nTotal: ₹${cartTotal}`
      : 'Empty';

    // Menu block (compact with IDs so LLM can pass correct UUIDs to tools)
    const menuLines = context.menu.length > 0
      ? context.menu.map((item: any) => {
          const base = item.basePrice ? ` ₹${item.basePrice}` : '';
          const variants = item.variants?.length > 0
            ? ` [${item.variants.map((v: any) => `${v.variantName}(${v.id}):₹${v.price}`).join(' | ')}]`
            : '';
          return `• ${item.name}(${item.id})${base}${variants}`;
        }).join('\n')
      : '';

    // Working memory / context block — compact
    const wmParts: string[] = [];
    if (wm.rollingSummary) {
      wmParts.push(`Context: ${wm.rollingSummary}`);
    } else {
      if (wm.lastReferencedItem) {
        wmParts.push(`Last item: ${wm.lastReferencedItem}${wm.lastReferencedVariant ? ` (${wm.lastReferencedVariant})` : ''}`);
      }
    }
    if (wm.pendingItem)     wmParts.push(`Awaiting variant for: ${wm.pendingItem}`);
    if (wm.pendingQuestion) wmParts.push(`Pending question: ${wm.pendingQuestion}`);
    const memBlock = wmParts.length > 0 ? '\n\nMEMORY:\n' + wmParts.join('\n') : '';

    // Greeting instruction
    const greetInstruct = isCartEmpty
      ? `Greet: "Hello! Welcome to ${context.restaurantName}. How can I help you?"`
      : `Cart is active. If customer greets, show cart and ask to continue or clear.`;

    return `You are a friendly restaurant employee at ${context.restaurantName}. Help customers order, answer menu questions, and handle checkout naturally.
Use tools ONLY for cart mutations (add/remove/update/clear/checkout). Do NOT call read tools — all info is already provided below.

CART:
${cartLines}
${menuLines ? '\nMENU (name(UUID) price [variant(variantUUID):price]):\n' + menuLines : ''}${memBlock}

RULES:
• CRITICAL: When calling tools, ALWAYS use the exact UUID shown in parentheses (e.g. name(abc-uuid)). NEVER invent or guess IDs.
• "ek aur"/"same"/"one more" → add last discussed item again (use MEMORY for UUID).
• "half"/"full" etc → use as variantId (UUID in parentheses) for pending item from MEMORY.
• "wo hata do" → remove last item from MEMORY using its UUID.
• Multi-variant items: always ask "Half ya Full?" before adding — never guess.
• Resolve pronouns using MEMORY above.
• ${greetInstruct}
• Reply in English/Hindi/Hinglish matching the customer. Be short and warm. No JSON, no lists.`;
  }
}

export const aiEmployeeService = new AiEmployeeService();
