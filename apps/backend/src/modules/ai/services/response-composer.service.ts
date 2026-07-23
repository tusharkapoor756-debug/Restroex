// ─── Response Composer ────────────────────────────────────────────────────────
//
// Receives the Execution Plan, validation results, and execution report and
// generates ONE natural, customer-facing WhatsApp reply.
//
// CONTRACT:
//  - Always returns exactly one string — never empty, never multiple messages.
//  - Never exposes JSON, execution plans, action types, or internal reasoning.
//  - Always sounds like a real restaurant employee.
//  - Falls back to an AI-generated reply when structured composition is insufficient.
//

import { logger } from '../../../infrastructure/logger/logger';
import { ExecutionPlan } from '../types/planner.types';
import { ActionExecutionReport, ActionResult } from './action-executor.service';
import { ActionValidationResult } from './action-validator.service';
import { OpenRouterService } from './openrouter.service';
import { MenuMappingItem } from '../types/parser.types';
import { CartItem } from '../../conversations/types/conversation.types';
import { getDisplayName } from '../../../shared/utils/display-name.util';

// ─── Composer Context ─────────────────────────────────────────────────────────

export interface ComposerContext {
  restaurantId: string;
  customerPhone: string;
  customerMessage: string;
  restaurantName: string;
  availableMenu: MenuMappingItem[];
  /** Updated cart AFTER execution (post-mutation state). */
  updatedCartItems: CartItem[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ResponseComposerService {
  private readonly ai: OpenRouterService;

  constructor() {
    this.ai = new OpenRouterService();
  }

  /**
   * Generates a single natural WhatsApp reply from execution results.
   *
   * Strategy:
   *  1. Try to compose a structured reply from the execution results.
   *  2. If the plan contains only knowledge / small-talk actions, fall back to AI prose.
   *  3. If composition fails entirely, return a graceful error message.
   */
  public async compose(
    plan: ExecutionPlan,
    validations: ActionValidationResult[],
    report: ActionExecutionReport,
    ctx: ComposerContext,
    mode: 'deterministic' | 'ai' = 'ai',
  ): Promise<string> {
    try {
      const parts: string[] = [];

      for (const result of report.results) {
        const part = this.composeSingleResult(result, ctx);
        if (part !== null) {
          parts.push(part);
        }
      }

      // Collect skipped/failed validations to inform the customer
      for (const { action, validation } of validations) {
        if (!validation.valid) {
          const skippedMsg = this.composeValidationFailure(action.type, validation.reason);
          if (skippedMsg) parts.push(skippedMsg);
        }
      }

      // If we have structured parts, combine them into one message
      if (parts.length > 0) {
        const body = parts.join('\n\n');
        return this.appendCartFooter(body, ctx, plan);
      }

      if (mode === 'deterministic') {
        logger.debug('ResponseComposer: deterministic mode requested but no parts composed — returning fallback response');
        return `Hello! Welcome to ${ctx.restaurantName} 👋. How can I help you today?`;
      }

      // Pure AI-handled actions (SMALL_TALK, ASK_KNOWLEDGE, UNKNOWN) — delegate to LLM
      return await this.generateAiReply(plan, ctx);

    } catch (error) {
      logger.error({ error }, 'ResponseComposer: failed to compose reply');
      return 'Kuch problem ho gayi. Kripya dobara try karein.';
    }
  }

  // ─── Single Result Composers ──────────────────────────────────────────────

  private composeSingleResult(
    result: ActionResult,
    ctx: ComposerContext,
  ): string | null {

    if (result.status === 'FAILED') {
      return this.composeFailure(result);
    }

    if (result.status === 'SKIPPED') {
      return null; // validation failures are handled separately
    }

    const d = result.data ?? {};

    switch (result.action) {
      case 'ADD_ITEM': {
        const needsVariant = Boolean(d['needsVariant']);
        const itemName = String(d['itemName'] ?? '');
        const qty = Number(d['quantity'] ?? 1);

        if (needsVariant) {
          const menuItem = ctx.availableMenu.find(item => item.id === d['menuItemId']);
          const variantLines = menuItem && menuItem.variants.length > 0
            ? menuItem.variants.map(v => `• ${v.variantName.charAt(0).toUpperCase() + v.variantName.slice(1)}`).join('\n')
            : '• Half\n• Full';

          return `You selected ${qty} ${itemName}.\n\nWhich variant would you like?\n\n${variantLines}`;
        }

        const price = Number(d['unitPrice'] ?? 0);
        const lineTotal = Number(d['lineTotal'] ?? qty * price);
        return `✅ *${qty} × ${itemName}* cart mein add kar diya — ₹${lineTotal}`;
      }

      case 'REMOVE_ITEM': {
        const itemName = String(d['itemName'] ?? '');
        return `🗑️ *${itemName}* cart se hata diya.`;
      }

      case 'UPDATE_QUANTITY': {
        const itemName = String(d['itemName'] ?? '');
        const qty = Number(d['quantity'] ?? 1);
        return `✏️ *${itemName}* ki quantity update kar di — ab ${qty} hai.`;
      }

      case 'UPDATE_VARIANT': {
        const itemName = String(d['itemName'] ?? '');
        const from = String(d['fromVariant'] ?? '');
        const to = String(d['toVariantName'] ?? '');
        const price = d['toVariantPrice'] != null ? ` — ₹${d['toVariantPrice']}` : '';
        return `✏️ *${itemName}* ka variant "${from}" se "${to}" kar diya${price}.`;
      }

      case 'VIEW_CART': {
        const items = d['items'] as Array<{
          itemName: string;
          quantity: number;
          lineTotal: number;
        }> | undefined;

        if (!items || items.length === 0) {
          return '🛒 Aapka cart abhi khali hai.\n\nKuch order karna chahte hain?';
        }

        const lines = items.map((ci) => `• ${ci.quantity} × ${ci.itemName} — ₹${ci.lineTotal}`);
        const total = Number(d['total'] ?? 0);
        return ['🛒 *Aapka Cart:*', '', ...lines, '', `*Total: ₹${total}*`].join('\n');
      }

      case 'CLEAR_CART': {
        return '🗑️ Cart clear kar diya. Naya order shuru kar sakte hain!';
      }

      case 'VIEW_MENU': {
        const menuText = String(d['menuText'] ?? '');
        return menuText || null;
      }

      case 'CHECKOUT': {
        const checkoutReply = d['checkoutReply'];
        return checkoutReply ? String(checkoutReply) : null;
      }

      case 'ASK_PRICE': {
        const itemName = String(d['itemName'] ?? '');
        const priceInfo = d['priceInfo'] as any;

        if (!priceInfo) return null;

        if (priceInfo.price != null) {
          return `💰 *${itemName}* ki price hai ₹${priceInfo.price}.`;
        }

        if (priceInfo.variants) {
          const lines = (priceInfo.variants as Array<{ name: string; price: number }>)
            .map((v) => `• ${v.name} — ₹${v.price}`);
          return [`💰 *${itemName}* ki prices:`, ...lines].join('\n');
        }

        return null;
      }

      case 'SEARCH_ITEM': {
        const found = Boolean(d['found']);
        const query = String(d['query'] ?? '');
        const items = d['items'] as Array<{ name: string; basePrice: number | null }> | undefined;

        if (!found || !items || items.length === 0) {
          return `❌ "${query}" menu mein nahi mila.`;
        }

        const lines = items.map((i) =>
          i.basePrice != null ? `• ${i.name} — ₹${i.basePrice}` : `• ${i.name}`,
        );
        return [`🔍 *"${query}" ke results:*`, ...lines].join('\n');
      }

      case 'GREETING':
        return `Hello! Welcome to ${ctx.restaurantName} 👋. How can I help you today?\n\nReply with "menu" to see our items!`;

      case 'CHECK_PAYMENT_STATUS':
        return `💳 We are verifying your payment status. If you have sent a screenshot, we will confirm it shortly. Thank you for your patience!`;

      case 'REPEAT_LAST_ORDER':
        return `🔄 We are retrieving your last order details. Please wait a moment.`;

      case 'SMALL_TALK':
      case 'ASK_KNOWLEDGE':
      case 'UNKNOWN':
        // These always trigger the AI reply path
        return null;

      default:
        return null;
    }
  }

  private composeFailure(result: ActionResult): string {
    const reason = result.reason || 'Kuch problem aayi.';
    switch (result.action) {
      case 'ADD_ITEM':
        return `❌ Item add nahi ho saka: ${reason}`;
      case 'REMOVE_ITEM':
        return `❌ Item remove nahi ho saka: ${reason}`;
      case 'CHECKOUT':
        return `❌ Checkout nahi ho saka: ${reason}`;
      default:
        return `❌ ${reason}`;
    }
  }

  private composeValidationFailure(actionType: string, reason?: string): string | null {
    if (!reason) return null;
    switch (actionType) {
      case 'ADD_ITEM':
        return `❌ "${reason}" menu mein nahi hai ya available nahi hai.`;
      case 'REMOVE_ITEM':
        return `❌ Yeh item aapke cart mein nahi hai.`;
      case 'CHECKOUT':
        return `❌ Pehle kuch items add karein, phir checkout karein.`;
      case 'CLEAR_CART':
        return `🛒 Cart pehle se khali hai.`;
      default:
        return null;
    }
  }

  // ─── Cart Footer ─────────────────────────────────────────────────────────

  /**
   * Appends a brief cart status footer when the updated cart is non-empty
   * and the reply doesn't already contain full cart information.
   */
  private appendCartFooter(body: string, ctx: ComposerContext, plan?: ExecutionPlan): string {
    if (plan) {
      const skipFooterTypes = ['GREETING', 'VIEW_MENU', 'CHECKOUT', 'CHECK_PAYMENT_STATUS', 'REPEAT_LAST_ORDER'];
      const hasSkipAction = plan.actions.some(a => skipFooterTypes.includes(a.type));
      if (hasSkipAction) {
        return body;
      }
    }
    if (body.includes('Which variant would you like?')) {
      return body;
    }
    const hasViewCart = body.includes('Aapka Cart:') || body.includes('🛒 *Aapka Cart:*');
    if (hasViewCart || ctx.updatedCartItems.length === 0) {
      return body;
    }

    const total = ctx.updatedCartItems.reduce(
      (sum, ci) => sum + ci.quantity * ci.unitPrice,
      0,
    );

    const footer = [
      '',
      `━━━━━━━━━━━━━━━━━━`,
      `🛒 Cart Total: ₹${total}`,
      '',
      'Aur kuch add karna hai? Ya "checkout" karein.',
    ].join('\n');

    return body + footer;
  }

  // ─── AI Reply Fallback ────────────────────────────────────────────────────

  /**
   * Generates an AI reply for conversational actions (greeting, small talk, knowledge).
   * Uses the existing OpenRouterService — no new LLM dependency introduced.
   */
  private async generateAiReply(
    plan: ExecutionPlan,
    ctx: ComposerContext,
  ): Promise<string> {
    const actionTypes = plan.actions.map((a) => a.type).join(', ');
    logger.debug({ actionTypes }, 'ResponseComposer: falling back to AI reply');

    // Build a concise context for the AI
    const cartSummary = this.buildCartSummary(ctx);

    const prompt = `You are the AI assistant for ${ctx.restaurantName}.

Current Cart:
${cartSummary}

Customer message: ${ctx.customerMessage}

Reply naturally in the same language as the customer (Hindi/Hinglish/English).
Keep it short and friendly. Do NOT mention JSON, action plans, or system internals.
Do NOT add items to the cart or change anything — just reply conversationally.`;

    try {
      return await this.ai.chat(prompt);
    } catch (error) {
      logger.error({ error }, 'ResponseComposer: AI reply failed');
      return 'Mujhe samajh nahi aaya. Kripya dobara try karein.';
    }
  }

  private buildCartSummary(ctx: ComposerContext): string {
    if (ctx.updatedCartItems.length === 0) return 'Khali (empty)';
    const lines = ctx.updatedCartItems.map((ci) => {
      const name = getDisplayName(ci, ctx.availableMenu);
      return `• ${ci.quantity} × ${name} — ₹${ci.quantity * ci.unitPrice}`;
    });
    const total = ctx.updatedCartItems.reduce((sum, ci) => sum + ci.quantity * ci.unitPrice, 0);
    return [...lines, `Total: ₹${total}`].join('\n');
  }
}
