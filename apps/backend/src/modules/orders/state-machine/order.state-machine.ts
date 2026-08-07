import { OrderStatus } from '../types/order.types';

export class OrderStateMachine {
  private static readonly TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    cart_active: ['checkout_pending', 'cancelled'],
    // checkout_pending → preparing: simplified 2-click KOT flow where clicking Accept Order moves directly to preparing
    checkout_pending: ['payment_pending', 'paid', 'accepted', 'preparing', 'cancelled'],
    payment_pending: ['paid', 'preparing', 'cancelled'],
    paid: ['accepted', 'preparing', 'cancelled'],
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
