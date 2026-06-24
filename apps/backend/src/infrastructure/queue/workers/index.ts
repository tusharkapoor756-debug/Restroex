import { logger } from '../../logger/logger';
export * from './whatsapp-incoming.worker';

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
  logger.info('Shutting down workers...');
};
