import { Worker, Job } from 'bullmq';
import { QueueName } from '../../../../infrastructure/queue/types/queue.types';
import { redisConnection } from '../../../../infrastructure/queue/config/queue.config';
import { PaymentAnalysisJobPayload } from './payment-analysis.producer';
import { storageService } from '../../../../infrastructure/storage/storage.service';
import { PaymentEngineFacade } from '../payment-engine.facade';
import { logger } from '../../../../infrastructure/logger/logger';

export class PaymentAnalysisWorker {
  private worker: Worker<PaymentAnalysisJobPayload>;
  private facade: PaymentEngineFacade;

  constructor(facade?: PaymentEngineFacade) {
    this.facade = facade ?? new PaymentEngineFacade();

    this.worker = new Worker<PaymentAnalysisJobPayload>(
      QueueName.PAYMENT_ANALYSIS,
      async (job: Job<PaymentAnalysisJobPayload>) => {
        logger.info({ jobId: job.id, paymentId: job.data.paymentId }, '📦 Job received');
        logger.info({ jobId: job.id, payload: job.data }, '📦 Job payload');
        await this.processJob(job.data);
      },
      {
        connection: redisConnection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, paymentId: job.data.paymentId }, '✅ Payment Analysis Worker finished job.');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, paymentId: job?.data?.paymentId, err }, '❌ Payment Analysis Worker job failed.');
    });

    logger.info('🚀 PaymentAnalysisWorker started');
  }

  private async processJob(payload: PaymentAnalysisJobPayload): Promise<void> {
    logger.info({ paymentId: payload.paymentId }, '⚙️ Processing background payment analysis job...');

    // Download screenshot buffer from storage
    let imageBuffer: Buffer | undefined;
    try {
      const slashIdx = payload.storagePath.indexOf('/');
      if (slashIdx !== -1) {
        const bucket = payload.storagePath.substring(0, slashIdx);
        const path = payload.storagePath.substring(slashIdx + 1);
        imageBuffer = await storageService.download(bucket, path);
      }
    } catch (storageErr) {
      logger.warn({ storageErr, path: payload.storagePath }, 'Could not download screenshot file buffer from storage');
    }

    await this.facade.analyzePaymentScreenshot(payload.paymentId, imageBuffer);
  }

  public async close(): Promise<void> {
    await this.worker.close();
  }
}
