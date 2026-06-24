import { OrderStatus } from '../types/order.types';

export class OrderStateMachine {
  private static readonly TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    cart_active: ['checkout_pending', 'cancelled'],
    checkout_pending: ['payment_pending', 'cancelled'],
    payment_pending: ['paid', 'cancelled'],
    paid: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: ['refunded'],
    cancelled: [],
    refunded: [],
  };

  /**
   * Validates if a transition from currentStatus to nextStatus is allowed.
   */
  public static isValidTransition(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    // If the transition is back to the same status, allow it (idempotency safety)
    if (currentStatus === nextStatus) {
      return true;
    }

    const allowed = OrderStateMachine.TRANSITIONS[currentStatus];
    if (!allowed) {
      return false;
    }

    return allowed.includes(nextStatus);
  }
}
