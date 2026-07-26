import { PaymentStatus } from '../types/payment.types';

// ============================================================
// Payment State Machine
// Universal states valid across all providers.
// ============================================================
export class PaymentStateMachine {
  private static readonly TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
    pending:               ['link_sent', 'initiated', 'screenshot_uploaded', 'pending_verification', 'cancelled', 'expired', 'failed'],
    link_sent:             ['customer_opened', 'processing', 'verified', 'failed', 'cancelled', 'expired'],
    customer_opened:       ['processing', 'verified', 'failed', 'cancelled', 'expired'],
    processing:            ['verified', 'failed', 'cancelled', 'expired'],
    initiated:             ['captured', 'verified', 'failed', 'cancelled', 'screenshot_uploaded', 'pending_verification'],
    screenshot_uploaded:   ['pending_verification', 'rejected'],
    pending_verification:  ['verified', 'rejected', 'failed'],
    verified:              ['refunded'],
    captured:              ['refunded'],
    failed:                ['pending', 'link_sent'],     // allow retry
    rejected:              ['pending', 'link_sent'],     // allow retry
    expired:               ['pending', 'link_sent'],     // allow retry
    cancelled:             ['pending', 'link_sent'],     // allow retry
    refunded:              [],
  };

  public static isValidTransition(current: PaymentStatus, next: PaymentStatus): boolean {
    return this.TRANSITIONS[current]?.includes(next) ?? false;
  }
}
