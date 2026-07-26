import { QueueFactory } from '../../../../infrastructure/queue/factories/queue.factory';
import { QueueName } from '../../../../infrastructure/queue/types/queue.types';
import { logger } from '../../../../infrastructure/logger/logger';

export interface PaymentAnalysisJobPayload {
  paymentId: string;
  orderId: string;
  restaurantId: string;
  expectedAmount: number;
  storagePath: string;
  merchantUpiId?: string;
  merchantName?: string;
  traceId: string;
  timestamp: string;
}

export class PaymentAnalysisProducer {
  private queue = QueueFactory.createQueue<PaymentAnalysisJobPayload>(QueueName.PAYMENT_ANALYSIS);

  /**
   * Enqueues an asynchronous payment analysis job for background processing.
   * Enables immediate non-blocking HTTP response on screenshot upload (<100ms).
   */
  public async enqueueAnalysis(payload: PaymentAnalysisJobPayload): Promise<void> {
    try {
      await this.queue.add('process-payment-analysis', payload, {
        jobId: `pay_analysis_${payload.paymentId}_${Date.now()}`,
        removeOnComplete: true,
        attempts: 3,
      });

      logger.info(
        { paymentId: payload.paymentId, orderId: payload.orderId },
        '📤 Asynchronous Payment Analysis Job enqueued.'
      );
    } catch (error: any) {
      logger.error({ error, paymentId: payload.paymentId }, '❌ Failed to enqueue payment analysis job');
    }
  }
}
