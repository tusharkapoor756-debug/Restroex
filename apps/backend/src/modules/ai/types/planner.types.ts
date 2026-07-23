// ─── Planner Types ─────────────────────────────────────────────────────────────
//
// This file defines the Execution Plan produced by the AiPlannerService.
//
// CONTRACT:
//  - The planner ONLY produces plans — it never executes them.
//  - Every action carries the minimum information needed for a Business Service
//    to execute it safely. IDs and prices are resolved by the backend, never here.
//  - Action types use a discriminated union so the adapter can switch exhaustively.
//

// ─── Action Types (string literals for LLM compatibility) ─────────────────────

export type PlannerActionType =
  // Cart
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'UPDATE_QUANTITY'
  | 'CLEAR_CART'
  | 'VIEW_CART'
  // Variant
  | 'UPDATE_VARIANT'
  | 'SET_VARIANT'
  // Menu
  | 'VIEW_MENU'
  | 'SEARCH_ITEM'
  | 'ASK_PRICE'
  // Checkout / Payment
  | 'CHECKOUT'
  | 'CHECK_PAYMENT_STATUS'
  // Repeat
  | 'REPEAT_LAST_ORDER'
  // Information
  | 'ASK_KNOWLEDGE'
  | 'GREETING'
  | 'SMALL_TALK'
  // Fallback
  | 'UNKNOWN';

// ─── Individual Action Shapes ─────────────────────────────────────────────────

export interface AddItemAction {
  type: 'ADD_ITEM';
  /** Raw item name exactly as the customer mentioned. Backend resolves the ID. */
  item: string;
  /** Variant name if mentioned (e.g. "full", "half", "large"). Backend resolves the ID. */
  variant?: string;
  /** Quantity requested. Default 1 if not specified. */
  quantity: number;
}

export interface RemoveItemAction {
  type: 'REMOVE_ITEM';
  /** Raw item name as mentioned by the customer. */
  item: string;
  /** Variant name if mentioned. */
  variant?: string;
}

export interface UpdateQuantityAction {
  type: 'UPDATE_QUANTITY';
  /** Raw item name. */
  item: string;
  /** The new absolute quantity requested, OR a delta like +1 / -1. */
  quantity: number;
  /** If true, quantity is a relative delta. If false/absent, it is absolute. */
  delta?: boolean;
}

export interface UpdateVariantAction {
  type: 'UPDATE_VARIANT';
  /** Item name (if specified). */
  item?: string;
  /** The variant to change FROM (e.g. "half"). */
  from: string;
  /** The variant to change TO (e.g. "full"). */
  to: string;
}

export interface SetVariantAction {
  type: 'SET_VARIANT';
  /** Item name. */
  item: string;
  /** Target variant name. */
  variant: string;
}

export interface ClearCartAction {
  type: 'CLEAR_CART';
}

export interface ViewCartAction {
  type: 'VIEW_CART';
}

export interface ViewMenuAction {
  type: 'VIEW_MENU';
  /** Optional category filter (e.g. "drinks", "starters"). */
  category?: string;
}

export interface SearchItemAction {
  type: 'SEARCH_ITEM';
  query: string;
}

export interface AskPriceAction {
  type: 'ASK_PRICE';
  item: string;
  variant?: string;
}

export interface CheckoutAction {
  type: 'CHECKOUT';
}

export interface CheckPaymentStatusAction {
  type: 'CHECK_PAYMENT_STATUS';
}

export interface RepeatLastOrderAction {
  type: 'REPEAT_LAST_ORDER';
}

export interface AskKnowledgeAction {
  type: 'ASK_KNOWLEDGE';
  /** The customer's question as understood by the planner. */
  question: string;
}

export interface GreetingAction {
  type: 'GREETING';
}

export interface SmallTalkAction {
  type: 'SMALL_TALK';
  /** The general topic (e.g. "recommendation", "wait time"). */
  topic?: string;
}

export interface UnknownAction {
  type: 'UNKNOWN';
}

// ─── Discriminated Union ──────────────────────────────────────────────────────

export type ExecutionAction =
  | AddItemAction
  | RemoveItemAction
  | UpdateQuantityAction
  | UpdateVariantAction
  | SetVariantAction
  | ClearCartAction
  | ViewCartAction
  | ViewMenuAction
  | SearchItemAction
  | AskPriceAction
  | CheckoutAction
  | CheckPaymentStatusAction
  | RepeatLastOrderAction
  | AskKnowledgeAction
  | GreetingAction
  | SmallTalkAction
  | UnknownAction;

// ─── Execution Plan ───────────────────────────────────────────────────────────

/**
 * The structured output of the AI Planner.
 * A single customer message may resolve to one or more sequential actions.
 */
export interface ExecutionPlan {
  /** Ordered list of actions to be executed. */
  actions: ExecutionAction[];
  /** Optional free-form reasoning captured by the planner for observability. */
  reasoning?: string;
}

// ─── Planner Context ─────────────────────────────────────────────────────────

/**
 * The full business context the planner receives before generating a plan.
 * This is built by the backend and injected into the prompt — the LLM never
 * reads raw DB data directly.
 */
export interface PlannerContext {
  restaurantName: string;
  /** Available menu items (names + variants only, no IDs, no internal fields). */
  menu: PlannerMenuItem[];
  /** Current cart as a human-readable representation. */
  cart: PlannerCartItem[];
  /** Customer's current conversation state (e.g. AWAITING_VARIANT). */
  conversationState: string;
}

export interface PlannerMenuItem {
  id: string;
  name: string;
  variants: { id: string; variantName: string; price: number }[];
  available: boolean;
  basePrice?: number | null;
}

export interface PlannerCartItem {
  itemName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

