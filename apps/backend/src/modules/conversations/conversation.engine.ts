import { ConversationState } from './conversation.states';
import { ConversationTransitions } from './conversation.transitions';
import { ConversationSession, FSMEvent, Cart, SessionContext } from './types/conversation.types';

export class ConversationEngine {
  private transitions: ConversationTransitions;

  constructor() {
    this.transitions = new ConversationTransitions();
  }

  /**
   * Processes a workflow event against the current session.
   * Returns the next state, updated cart, and updated context.
   */
  public processEvent(
    session: ConversationSession,
    event: FSMEvent
  ): { nextState: ConversationState; updatedCart: Cart; updatedContext: SessionContext } {
    const currentState = session.state;
    const nextState = this.transitions.getNextState(currentState, event.name);

    let updatedCart = { ...session.cart };
    let updatedContext = { ...session.context };

    // Prevent modifying a session that is handed over to a human operator
    if (currentState === ConversationState.HUMAN_TAKEOVER && event.name !== 'RESET') {
      return {
        nextState: ConversationState.HUMAN_TAKEOVER,
        updatedCart,
        updatedContext,
      };
    }

    // Process State Mutation Logic based on the FSM Event
    switch (event.name) {
      case 'START_ORDER':
        // Initialize/Clear cart when starting a fresh order
        updatedCart = { items: [] };
        updatedContext = {};
        break;

      case 'ITEM_ADDED': {
        const { menuItemId, quantity, unitPrice, variantId } = event.payload;
        // Append item to cart (if matching item+variant already exists, increment quantity)
        const existingIndex = updatedCart.items.findIndex(
          (item) => item.menuItemId === menuItemId && item.variantId === variantId
        );

        const existingItem = existingIndex > -1 ? updatedCart.items[existingIndex] : undefined;
        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          updatedCart.items.push({ menuItemId, quantity, unitPrice, variantId });
        }
        break;
      }

      case 'NEED_VARIANT': {
        const { menuItemId, itemName } = event.payload;
        updatedContext.pendingVariantItemId = menuItemId;
        updatedContext.lastParsedItemName = itemName;
        break;
      }

      case 'CHOOSE_VARIANT': {
        const { variantId, unitPrice } = event.payload;
        const pendingItemId = updatedContext.pendingVariantItemId;
        if (pendingItemId) {
          // Add item with variant to the cart (default quantity = 1, can be adjusted in next state)
          updatedCart.items.push({
            menuItemId: pendingItemId,
            quantity: 1,
            unitPrice,
            variantId,
          });
          delete updatedContext.pendingVariantItemId;
        }
        break;
      }

      case 'SET_QUANTITY': {
        const { quantity } = event.payload;
        // Apply quantity to the last added item in the cart
        if (updatedCart.items.length > 0) {
          const lastItem = updatedCart.items[updatedCart.items.length - 1];
          if (lastItem) {
            lastItem.quantity = quantity;
          }
        }
        break;
      }

      case 'ADD_MORE':
        // Simple return statement to allow adding items, context remains intact
        break;

      case 'PROCEED_TO_CHECKOUT':
        // Capture order details to context if provided
        if (event.payload?.checkoutOrderId) {
          updatedContext.checkoutOrderId = event.payload.checkoutOrderId;
        }
        break;

      case 'CONFIRM_ORDER':
        // Ready for payment
        break;

      case 'PAYMENT_RECEIVED':
        // Transition to completed
        break;

      case 'TRIGGER_TAKEOVER':
        updatedContext.failureReason = event.payload?.reason || 'Operator triggered manual bypass';
        break;

      case 'RESET':
        updatedCart = { items: [] };
        updatedContext = {};
        break;
    }

    return {
      nextState,
      updatedCart,
      updatedContext,
    };
  }
}
