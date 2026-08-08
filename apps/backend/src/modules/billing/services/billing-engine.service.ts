import { walletService } from '../../wallet/services/wallet.service';
import { logger } from '../../../infrastructure/logger/logger';

export class BillingEngineService {
  /**
   * Business Policy Engine: Evaluates SaaS credit deduction on order completion.
   * Standard policy: 1 software credit per completed order.
   */
  public async handleOrderCompleted(restaurantId: string, orderId: string): Promise<void> {
    try {
      logger.info({ restaurantId, orderId }, 'BillingEngine: Processing order completion software credit deduction');
      await walletService.deductCredits(
        restaurantId,
        1,
        `SaaS credit deduction for order #${orderId.substring(0, 8)}`,
        orderId
      );
    } catch (err) {
      logger.warn({ err, restaurantId, orderId }, 'BillingEngine: Failed to deduct SaaS software credit on order completion');
    }
  }
}

export const billingEngineService = new BillingEngineService();
