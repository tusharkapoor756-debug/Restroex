import { PaymentStatus } from '../types/payment.types';

// ============================================================
// Payment State Machine
// Universal states valid across all providers.
// ============================================================
export class PaymentStateMachine {
  private static readonly TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    pending:               ['initiated', 'screenshot_uploaded', 'pending_verification', 'cancelled'],
    initiated:             ['captured', 'failed', 'cancelled', 'screenshot_uploaded', 'pending_verification'],
    screenshot_uploaded:   ['pending_verification', 'rejected'],
    pending_verification:  ['verified', 'rejected'],
    verified:              ['refunded'],
    captured:              ['refunded'],
    failed:                ['pending'],     // allow retry
    rejected:              ['pending'],     // allow retry
    refunded:              [],
    cancelled:             [],
  };

  public static isValidTransition(current: PaymentStatus, next: PaymentStatus): boolean {
    return this.TRANSITIONS[current]?.includes(next) ?? false;
  }
}
