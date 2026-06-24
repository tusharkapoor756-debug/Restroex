// apps/backend/src/modules/orders/tests/order-verification.ts
import { OrderStateMachine } from '../state-machine/order.state-machine';
import { OrderStatus } from '../types/order.types';

function runOrderVerification() {
  console.log('🧪 Starting Order State Machine Verification...');

  const assertTransition = (from: OrderStatus, to: OrderStatus, expected: boolean) => {
    const result = OrderStateMachine.isValidTransition(from, to);
    if (result !== expected) {
      console.error(`❌ Transition from [${from}] to [${to}] expected [${expected}], but got [${result}]`);
      process.exit(1);
    }
    console.log(`✅ Transition from [${from}] to [${to}] is ${result ? 'ALLOWED' : 'FORBIDDEN'} as expected.`);
  };

  // Scenario 1: Verify Happy Path transitions
  console.log('\n--- Scenario 1: Happy Path ---');
  assertTransition('cart_active', 'checkout_pending', true);
  assertTransition('checkout_pending', 'payment_pending', true);
  assertTransition('payment_pending', 'paid', true);
  assertTransition('paid', 'accepted', true);
  assertTransition('accepted', 'preparing', true);
  assertTransition('preparing', 'ready', true);
  assertTransition('ready', 'completed', true);
  assertTransition('completed', 'refunded', true);

  // Scenario 2: Verify Cancellation Flows
  console.log('\n--- Scenario 2: Cancellation Boundaries ---');
  assertTransition('payment_pending', 'cancelled', true);
  assertTransition('preparing', 'cancelled', true);
  assertTransition('completed', 'cancelled', false); // Cannot cancel a completed order

  // Scenario 3: Verify Illegal Transitions
  console.log('\n--- Scenario 3: Illegal / Out-of-Order Jumps ---');
  assertTransition('checkout_pending', 'preparing', false); // Cannot jump straight to preparing
  assertTransition('paid', 'checkout_pending', false); // Cannot jump backwards

  console.log('\n🌟 ALL ORDER STATE MACHINE SCENARIOS PASSED SUCCESSFULLY!');
}

runOrderVerification();
