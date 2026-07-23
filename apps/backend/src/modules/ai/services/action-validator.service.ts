// ─── Action Validator ─────────────────────────────────────────────────────────
//
// This service validates every ExecutionAction before it is handed to the
// ActionExecutorService. Validation is purely read-only — it queries existing
// state (menu, cart, session) but NEVER mutates anything.
//
// CONTRACT:
//  - Never throws. Always returns a ValidationResult.
//  - Never accesses the database directly — reads from provided context snapshots.
//  - The executor must not run any action whose validation returned valid=false.
//

import { logger } from '../../../infrastructure/logger/logger';
import {
  ExecutionAction,
  AddItemAction,
  RemoveItemAction,
  UpdateQuantityAction,
  UpdateVariantAction,
  SetVariantAction,
  AskPriceAction,
  SearchItemAction,
} from '../types/planner.types';
import { MenuMappingItem } from '../types/parser.types';
import { CartItem } from '../../conversations/types/conversation.types';

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  /** Human-readable reason shown in logs (NOT sent to the customer). */
  reason?: string;
  /** Resolved menu item after fuzzy matching — passed to executor to avoid double lookup. */
  resolvedMenuItem?: MenuMappingItem;
  /** Resolved variant after matching. */
  resolvedVariant?: { id: string; variantName: string; price: number };
}

export interface ActionValidationResult {
  action: ExecutionAction;
  validation: ValidationResult;
}

// ─── Validation Context ───────────────────────────────────────────────────────

/**
 * A read-only snapshot of the current business state.
 * Provided by the caller — the validator never fetches data itself.
 */
export interface ValidationContext {
  /** Full menu from the repository (with variants and prices). */
  menu: MenuMappingItem[];
  /** Current cart items from the session. */
  cartItems: CartItem[];
  /** Current FSM state (e.g. 'IDLE', 'AWAITING_ITEM'). */
  conversationState: string;
  /** Whether the customer has a pending payment awaiting screenshot. */
  hasPendingPayment: boolean;
  /** Whether the customer has an active order. */
  hasActiveOrder: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ActionValidatorService {

  /**
   * Validates a full list of actions from an Execution Plan.
   * Returns one result per action, preserving order.
   */
  public validateAll(
    actions: ExecutionAction[],
    ctx: ValidationContext,
  ): ActionValidationResult[] {
    return actions.map((action) => ({
      action,
      validation: this.validate(action, ctx),
    }));
  }

  /**
   * Validates a single action against the current context.
   * Never throws — wraps errors in a failed ValidationResult.
   */
  public validate(action: ExecutionAction, ctx: ValidationContext): ValidationResult {
    try {
      switch (action.type) {
        case 'ADD_ITEM':
          return this.validateAddItem(action, ctx);

        case 'REMOVE_ITEM':
          return this.validateRemoveItem(action, ctx);

        case 'UPDATE_QUANTITY':
          return this.validateUpdateQuantity(action, ctx);

        case 'UPDATE_VARIANT':
          return this.validateUpdateVariant(action, ctx);

        case 'SET_VARIANT':
          return this.validateSetVariant(action, ctx);

        case 'CLEAR_CART':
          return this.validateCartNotEmpty(ctx, 'CLEAR_CART');

        case 'CHECKOUT':
          return this.validateCheckout(ctx);

        case 'CHECK_PAYMENT_STATUS':
          return this.validateCheckPaymentStatus(ctx);

        case 'REPEAT_LAST_ORDER':
          return this.validateHasActiveOrder(ctx, action.type);

        case 'ASK_PRICE':
          return this.validateAskPrice(action as AskPriceAction, ctx);

        case 'SEARCH_ITEM':
          return this.validateSearchItem(action as SearchItemAction, ctx);

        // These are always valid — no preconditions required
        case 'VIEW_CART':
        case 'VIEW_MENU':
        case 'ASK_KNOWLEDGE':
        case 'GREETING':
        case 'SMALL_TALK':
        case 'UNKNOWN':
          return { valid: true };

        default:
          return { valid: false, reason: `Unknown action type: ${(action as any).type}` };
      }
    } catch (error) {
      logger.error({ error, action }, 'ActionValidator: unexpected error during validation');
      return { valid: false, reason: 'Internal validation error' };
    }
  }

  // ─── Individual Validators ─────────────────────────────────────────────────

  private validateAddItem(action: AddItemAction, ctx: ValidationContext): ValidationResult {
    const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);

    if (!match) {
      return {
        valid: false,
        reason: `Item "${action.item}" not found in menu`,
      };
    }

    if (!match.available) {
      return {
        valid: false,
        reason: `Item "${match.name}" is currently unavailable`,
      };
    }

    // If item has variants and customer specified one, check it exists
    if (action.variant && match.variants.length > 0) {
      const variant = this.fuzzyMatchVariant(action.variant, match.variants);
      if (!variant) {
        return {
          valid: false,
          reason: `Variant "${action.variant}" not found for "${match.name}"`,
        };
      }
      return { valid: true, resolvedMenuItem: match, resolvedVariant: variant };
    }

    return { valid: true, resolvedMenuItem: match };
  }

  private validateRemoveItem(action: RemoveItemAction, ctx: ValidationContext): ValidationResult {
    if (ctx.cartItems.length === 0) {
      return { valid: false, reason: 'Cart is empty — nothing to remove' };
    }

    const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);
    if (!match) {
      return { valid: false, reason: `Item "${action.item}" not found in menu` };
    }

    // Check that this item is actually in the cart
    const inCart = ctx.cartItems.some((ci) => ci.menuItemId === match.id);
    if (!inCart) {
      return {
        valid: false,
        reason: `"${match.name}" is not in the cart`,
      };
    }

    return { valid: true, resolvedMenuItem: match };
  }

  private validateUpdateQuantity(
    action: UpdateQuantityAction,
    ctx: ValidationContext,
  ): ValidationResult {
    if (ctx.cartItems.length === 0) {
      return { valid: false, reason: 'Cart is empty — nothing to update' };
    }

    const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);
    if (!match) {
      return { valid: false, reason: `Item "${action.item}" not found in menu` };
    }

    const inCart = ctx.cartItems.some((ci) => ci.menuItemId === match.id);
    if (!inCart) {
      return { valid: false, reason: `"${match.name}" is not in the cart` };
    }

    if (action.quantity < 1) {
      return { valid: false, reason: 'Quantity must be at least 1' };
    }

    return { valid: true, resolvedMenuItem: match };
  }

  private validateUpdateVariant(
    action: UpdateVariantAction,
    ctx: ValidationContext,
  ): ValidationResult {
    if (ctx.cartItems.length === 0) {
      return { valid: false, reason: 'Cart is empty — nothing to update' };
    }

    // If no specific item named, we'll look for any cart item that has the "from" variant
    if (action.item) {
      const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);
      if (!match) {
        return { valid: false, reason: `Item "${action.item}" not found in menu` };
      }

      const targetVariant = this.fuzzyMatchVariant(action.to, match.variants);
      if (!targetVariant) {
        return {
          valid: false,
          reason: `Variant "${action.to}" does not exist for "${match.name}"`,
        };
      }

      return { valid: true, resolvedMenuItem: match, resolvedVariant: targetVariant };
    }

    // No item specified — scan cart for any item that has the target variant
    for (const cartItem of ctx.cartItems) {
      const menuItem = ctx.menu.find((m) => m.id === cartItem.menuItemId);
      if (!menuItem || !menuItem.variants) continue;

      const targetVariant = this.fuzzyMatchVariant(action.to, menuItem.variants);
      if (targetVariant) {
        return { valid: true, resolvedMenuItem: menuItem, resolvedVariant: targetVariant };
      }
    }

    return {
      valid: false,
      reason: `No cart item found with a variant matching "${action.to}"`,
    };
  }

  private validateSetVariant(
    action: SetVariantAction,
    ctx: ValidationContext,
  ): ValidationResult {
    const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);
    if (!match) {
      return { valid: false, reason: `Item "${action.item}" not found in menu` };
    }

    const targetVariant = this.fuzzyMatchVariant(action.variant, match.variants);
    if (!targetVariant) {
      return {
        valid: false,
        reason: `Variant "${action.variant}" does not exist for "${match.name}"`,
      };
    }

    return { valid: true, resolvedMenuItem: match, resolvedVariant: targetVariant };
  }

  private validateCartNotEmpty(ctx: ValidationContext, actionType: string): ValidationResult {
    if (ctx.cartItems.length === 0) {
      return { valid: false, reason: `${actionType}: cart is already empty` };
    }
    return { valid: true };
  }

  private validateCheckout(ctx: ValidationContext): ValidationResult {
    if (ctx.cartItems.length === 0) {
      return { valid: false, reason: 'Cannot checkout — cart is empty' };
    }
    return { valid: true };
  }

  private validateCheckPaymentStatus(ctx: ValidationContext): ValidationResult {
    if (!ctx.hasPendingPayment) {
      return { valid: false, reason: 'No pending payment to check' };
    }
    return { valid: true };
  }

  private validateHasActiveOrder(ctx: ValidationContext, actionType: string): ValidationResult {
    if (!ctx.hasActiveOrder) {
      return { valid: false, reason: `${actionType}: no active order found` };
    }
    return { valid: true };
  }

  private validateAskPrice(action: AskPriceAction, ctx: ValidationContext): ValidationResult {
    const match = this.fuzzyMatchMenuItem(action.item, ctx.menu);
    if (!match) {
      return { valid: false, reason: `Item "${action.item}" not found in menu` };
    }
    return { valid: true, resolvedMenuItem: match };
  }

  private validateSearchItem(action: SearchItemAction, ctx: ValidationContext): ValidationResult {
    if (!action.query || action.query.trim().length === 0) {
      return { valid: false, reason: 'Search query is empty' };
    }
    return { valid: true };
  }

  // ─── Fuzzy Matching Helpers ────────────────────────────────────────────────

  /**
   * Fuzzy matches an item name against the menu.
   * Priority: exact → alias → prefix → substring.
   */
  private fuzzyMatchMenuItem(
    rawName: string,
    menu: MenuMappingItem[],
  ): (MenuMappingItem & { available: boolean }) | undefined {
    const q = rawName.toLowerCase().trim();

    const itemWithAvailability = (item: MenuMappingItem) => ({
      ...item,
      available: (item as any).isAvailable !== false,
    });

    // 1. Exact name match
    const exact = menu.find((m) => m.name.toLowerCase() === q);
    if (exact) return itemWithAvailability(exact);

    // 2. Alias match
    const alias = menu.find((m) =>
      m.aliases.some((a) => a.toLowerCase() === q),
    );
    if (alias) return itemWithAvailability(alias);

    // 3. Name starts with query
    const prefix = menu.find((m) => m.name.toLowerCase().startsWith(q));
    if (prefix) return itemWithAvailability(prefix);

    // 4. Name contains query (substring)
    const matches = menu.filter((m) => m.name.toLowerCase().includes(q));
    if (matches.length === 1 && matches[0]) return itemWithAvailability(matches[0]);

    return undefined;
  }

  /**
   * Fuzzy matches a variant name against the item's variant list.
   * Priority: exact → starts-with → contains.
   */
  private fuzzyMatchVariant(
    rawVariant: string,
    variants: { id: string; variantName: string; price: number }[],
  ): { id: string; variantName: string; price: number } | undefined {
    const q = rawVariant.toLowerCase().trim();

    const exact = variants.find((v) => v.variantName.toLowerCase() === q);
    if (exact) return exact;

    const prefix = variants.find((v) => v.variantName.toLowerCase().startsWith(q));
    if (prefix) return prefix;

    const contains = variants.filter((v) => v.variantName.toLowerCase().includes(q));
    if (contains.length === 1) return contains[0];

    return undefined;
  }
}
