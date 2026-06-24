// apps/backend/src/modules/conversations/tests/fsm-verification.ts
import { ConversationEngine } from '../conversation.engine';
import { ConversationState } from '../conversation.states';
import { ConversationSession } from '../types/conversation.types';

function runFSMVerification() {
  console.log('🧪 Starting FSM Engine Verification Test...');

  const engine = new ConversationEngine();

  // 1. Initialize session
  let session: ConversationSession = {
    id: 'test-session-id',
    restaurantId: 'test-restaurant-id',
    customerPhone: '+919876543210',
    state: ConversationState.IDLE,
    cart: { items: [] },
    context: {},
    lastInteractionAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const assertState = (expected: ConversationState) => {
    if (session.state !== expected) {
      console.error(`❌ Expected state [${expected}], but got [${session.state}]`);
      process.exit(1);
    }
    console.log(`✅ State is [${session.state}] as expected.`);
  };

  // Step A: Start Order
  console.log('\n--- Scenario 1: Basic Cart Flow ---');
  let result = engine.processEvent(session, { name: 'START_ORDER' });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_ITEM);

  // Step B: Add Butter Chicken (needs variant)
  result = engine.processEvent(session, {
    name: 'NEED_VARIANT',
    payload: { menuItemId: 'butter-chicken-uuid', itemName: 'Butter Chicken' },
  });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_VARIANT);
  if (session.context.pendingVariantItemId !== 'butter-chicken-uuid') {
    console.error('❌ Context failed to save pending variant ID');
    process.exit(1);
  }
  console.log('✅ Context correctly holds pending variant details.');

  // Step C: Choose Half Variant
  result = engine.processEvent(session, {
    name: 'CHOOSE_VARIANT',
    payload: { variantId: 'half-variant-uuid', unitPrice: 280 },
  });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_QUANTITY);

  // Step D: Set quantity to 2
  result = engine.processEvent(session, {
    name: 'SET_QUANTITY',
    payload: { quantity: 2 },
  });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_ITEM);
  console.log('✅ Cart Items Count:', session.cart.items.length);
  const firstItem = session.cart.items[0];
  if (!firstItem || firstItem.quantity !== 2) {
    console.error('❌ Quantity was not set to 2');
    process.exit(1);
  }

  // Scenario 2: Interruption (Add Rumali Roti during Confirmation Flow)
  console.log('\n--- Scenario 2: Interruption during Confirmation Flow ---');
  // Proceed to checkout
  result = engine.processEvent(session, { name: 'PROCEED_TO_CHECKOUT' });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_CONFIRMATION);

  // Customer interrupts: "1 rumali add karde" -> triggers ITEM_ADDED (goes back to item flow or appends directly)
  // Let's transition back to AWAITING_ITEM to handle interruption
  result = engine.processEvent(session, { name: 'ADD_MORE' });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_ITEM);

  result = engine.processEvent(session, {
    name: 'ITEM_ADDED',
    payload: { menuItemId: 'rumali-roti-uuid', quantity: 1, unitPrice: 20 },
  });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_ITEM);

  // Go to checkout again
  result = engine.processEvent(session, { name: 'PROCEED_TO_CHECKOUT' });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.AWAITING_CONFIRMATION);

  console.log('✅ Cart after interruption:', JSON.stringify(session.cart.items));
  if (session.cart.items.length !== 2) {
    console.error('❌ Item count is not 2 after append interruption');
    process.exit(1);
  }

  // Scenario 3: Global Human Takeover Interruption
  console.log('\n--- Scenario 3: Global Human Takeover ---');
  result = engine.processEvent(session, { name: 'TRIGGER_TAKEOVER', payload: { reason: 'System could not parse user response' } });
  session = { ...session, state: result.nextState, cart: result.updatedCart, context: result.updatedContext };
  assertState(ConversationState.HUMAN_TAKEOVER);
  console.log('✅ Context failure reason:', session.context.failureReason);

  console.log('\n🌟 ALL FSM ENGINE VALIDATION SCENARIOS PASSED SUCCESSFULLY!');
}

runFSMVerification();
