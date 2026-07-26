import { logger } from '../../logger/logger';
import { PaymentAnalysisWorker } from '../../../modules/payments/engine/queue/payment-analysis.worker';

export * from './whatsapp-incoming.worker';

let paymentAnalysisWorkerInstance: PaymentAnalysisWorker | null = null;

export const startPaymentAnalysisWorker = (): PaymentAnalysisWorker => {
  if (!paymentAnalysisWorkerInstance) {
    paymentAnalysisWorkerInstance = new PaymentAnalysisWorker();
    logWorkerStartup('PaymentAnalysisWorker');
  }
  return paymentAnalysisWorkerInstance;
};

/**
 * Logs the startup of a background worker.
 */
export const logWorkerStartup = (workerName: string): void => {
  logger.info({ worker: workerName }, `👷 Worker started: ${workerName}`);
};

/**
 * Logs the shutdown of a background worker.
 */
export const logWorkerShutdown = (workerName: string): void => {
  logger.info({ worker: workerName }, `🛑 Worker stopped: ${workerName}`);
};

/**
 * Logs the overall workers shutdown process.
 */
export const shutdownWorkers = (): void => {
  if (paymentAnalysisWorkerInstance) {
    paymentAnalysisWorkerInstance.close().catch(() => {});
  }
  logger.info('Shutting down workers...');
};
