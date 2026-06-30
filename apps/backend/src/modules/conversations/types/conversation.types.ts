import { ConversationState } from '../conversation.states';

export interface CartItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
}

export interface Cart {
  items: CartItem[];
}

export interface SessionContext {
  lastMessageId?: string;
  pendingVariantItemId?: string;
  lastParsedItemName?: string;
  pendingQuantity?: number;
  pendingCustomization?: string;
  checkoutOrderId?: string;
  failureReason?: string;
}

export interface ConversationSession {
  id: string;
  restaurantId: string;
  customerPhone: string;
  state: ConversationState;
  cart: Cart;
  context: SessionContext;
  lastInteractionAt: string;
  createdAt: string;
  updatedAt: string;
}

export type FSMEventName =
  | 'START_ORDER'
  | 'ITEM_ADDED'
  | 'NEED_VARIANT'
  | 'CHOOSE_VARIANT'
  | 'SET_QUANTITY'
  | 'PROCEED_TO_CHECKOUT'
  | 'CONFIRM_ORDER'
  | 'ADD_MORE'
  | 'PAYMENT_RECEIVED'
  | 'TRIGGER_TAKEOVER'
  | 'RESET';

export interface FSMEvent {
  name: FSMEventName;
  payload?: any;
}
