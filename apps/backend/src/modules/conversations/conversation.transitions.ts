import { ConversationState } from './conversation.states';
import { FSMEventName } from './types/conversation.types';

export class ConversationTransitions {
  // Centralized State Transition Map
  private static readonly TRANSITION_MAP: Record<ConversationState, Partial<Record<FSMEventName, ConversationState>>> = {
    [ConversationState.IDLE]: {
      START_ORDER: ConversationState.AWAITING_ITEM,
      ITEM_ADDED: ConversationState.AWAITING_ITEM,
      NEED_VARIANT: ConversationState.AWAITING_VARIANT,
      START_ONBOARDING: ConversationState.AWAITING_NAME,
      START_RECOVERY: ConversationState.AWAITING_RECOVERY,
    },
    [ConversationState.AWAITING_ITEM]: {
      ITEM_ADDED: ConversationState.AWAITING_ITEM,
      ITEM_REMOVED: ConversationState.AWAITING_ITEM,
      ITEM_UPDATED: ConversationState.AWAITING_ITEM,
      VARIANT_UPDATED: ConversationState.AWAITING_ITEM,
      QUANTITY_UPDATED: ConversationState.AWAITING_ITEM,
      ADD_MORE: ConversationState.AWAITING_ITEM,
      NEED_VARIANT: ConversationState.AWAITING_VARIANT,
      SET_QUANTITY: ConversationState.AWAITING_QUANTITY,
      PROCEED_TO_CHECKOUT: ConversationState.AWAITING_CONFIRMATION,
      SELECT_ORDER_MODE: ConversationState.AWAITING_ORDER_MODE,
      PROVIDE_TABLE_NUMBER: ConversationState.AWAITING_TABLE_NUMBER,
    },
    [ConversationState.AWAITING_VARIANT]: {
      CHOOSE_VARIANT: ConversationState.AWAITING_QUANTITY,
    },
    [ConversationState.AWAITING_QUANTITY]: {
      ITEM_ADDED: ConversationState.AWAITING_ITEM,
      SET_QUANTITY: ConversationState.AWAITING_ITEM, // Quantity locked, return to accept new items
      PROCEED_TO_CHECKOUT: ConversationState.AWAITING_CONFIRMATION,
      SELECT_ORDER_MODE: ConversationState.AWAITING_ORDER_MODE,
      PROVIDE_TABLE_NUMBER: ConversationState.AWAITING_TABLE_NUMBER,
    },
    [ConversationState.AWAITING_CONFIRMATION]: {
      CONFIRM_ORDER: ConversationState.AWAITING_PAYMENT,
      SELECT_ORDER_MODE: ConversationState.AWAITING_ORDER_MODE,
      PROVIDE_TABLE_NUMBER: ConversationState.AWAITING_TABLE_NUMBER,
      AWAIT_PAYMENT_SCREENSHOT: ConversationState.AWAITING_PAYMENT_SCREENSHOT,
      ADD_MORE: ConversationState.AWAITING_ITEM,
    },
    [ConversationState.AWAITING_ORDER_MODE]: {
      SELECT_ORDER_MODE: ConversationState.AWAITING_ORDER_MODE,
      PROVIDE_TABLE_NUMBER: ConversationState.AWAITING_TABLE_NUMBER,
      CONFIRM_ORDER: ConversationState.AWAITING_PAYMENT,
      ADD_MORE: ConversationState.AWAITING_ITEM,
    },
    [ConversationState.AWAITING_TABLE_NUMBER]: {
      PROVIDE_TABLE_NUMBER: ConversationState.AWAITING_TABLE_NUMBER,
      CONFIRM_ORDER: ConversationState.AWAITING_PAYMENT,
      ADD_MORE: ConversationState.AWAITING_ITEM,
    },
    [ConversationState.AWAITING_PAYMENT]: {
      PAYMENT_RECEIVED: ConversationState.PAYMENT_COMPLETED,
    },
    [ConversationState.AWAITING_PAYMENT_SCREENSHOT]: {
      SCREENSHOT_UPLOADED: ConversationState.PAYMENT_COMPLETED,
    },
    [ConversationState.PAYMENT_COMPLETED]: {
      RESET: ConversationState.IDLE,
    },
    [ConversationState.HUMAN_TAKEOVER]: {
      RESET: ConversationState.IDLE,
    },
    [ConversationState.AWAITING_NAME]: {
      PROVIDE_NAME: ConversationState.AWAITING_ADDRESS,
      START_ONBOARDING: ConversationState.AWAITING_NAME, // idempotent re-entry
    },
    [ConversationState.AWAITING_ADDRESS]: {
      PROVIDE_ADDRESS: ConversationState.AWAITING_PROFILE_CONFIRMATION,
    },
    [ConversationState.AWAITING_PROFILE_CONFIRMATION]: {
      CONFIRM_PROFILE: ConversationState.AWAITING_ITEM,
      EDIT_PROFILE: ConversationState.AWAITING_NAME,
    },
    [ConversationState.AWAITING_RECOVERY]: {
      CONFIRM_PROFILE: ConversationState.AWAITING_ITEM,
      RESET: ConversationState.IDLE,
    },
  };

  /**
   * Determines the next state based on the current state and incoming event.
   * Allows global transitions (TRIGGER_TAKEOVER, RESET) from any state.
   */
  public getNextState(currentState: ConversationState, eventName: FSMEventName): ConversationState {
    // 1. Handle Global / Interruption Transitions
    if (eventName === 'TRIGGER_TAKEOVER') {
      return ConversationState.HUMAN_TAKEOVER;
    }
    if (eventName === 'RESET') {
      return ConversationState.IDLE;
    }

    // 2. Fetch specific transition from the map
    const stateTransitions = ConversationTransitions.TRANSITION_MAP[currentState];
    if (!stateTransitions) {
      return currentState;
    }

    const nextState = stateTransitions[eventName];
    if (!nextState) {
      // If transition is invalid, keep the current state (ignore/gracefully bypass)
      return currentState;
    }

    return nextState;
  }
}
