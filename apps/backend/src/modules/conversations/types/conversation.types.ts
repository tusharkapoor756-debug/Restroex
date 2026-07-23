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
  navigationStack?: string[];
  lastInteractiveScreen?: {
    id: string;
    options: Array<{ key: string; payload: any }>;
  };
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
  | 'ITEM_REMOVED'
  | 'ITEM_UPDATED'
  | 'VARIANT_UPDATED'
  | 'QUANTITY_UPDATED'
  | 'NEED_VARIANT'
  | 'CHOOSE_VARIANT'
  | 'SET_QUANTITY'
  | 'PROCEED_TO_CHECKOUT'
  | 'CONFIRM_ORDER'
  | 'ADD_MORE'
  | 'AWAIT_PAYMENT_SCREENSHOT'
  | 'SCREENSHOT_UPLOADED'
  | 'PAYMENT_RECEIVED'
  | 'TRIGGER_TAKEOVER'
  | 'PROVIDE_NAME'
  | 'PROVIDE_ADDRESS'
  | 'CONFIRM_PROFILE'
  | 'EDIT_PROFILE'
  | 'START_ONBOARDING'
  | 'START_RECOVERY'
  | 'RESET';

export interface FSMEvent {
  name: FSMEventName;
  payload?: any;
}
