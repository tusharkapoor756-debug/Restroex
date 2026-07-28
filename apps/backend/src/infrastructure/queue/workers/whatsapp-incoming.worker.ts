import { Worker } from 'bullmq';
import { bullMQConfig } from '../bullmq.config';
import { QueueName } from '../types/queue.types';
import { logger } from '../../logger/logger';
import { messageDebouncer } from '../../../modules/whatsapp/message-debouncer.service';

let worker: Worker | null = null;

export const startWhatsAppIncomingWorker = (): Worker => {
  if (worker) return worker;

  worker = new Worker(
    QueueName.WHATSAPP_INCOMING,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing inbound WhatsApp bot message through debouncer');
      await messageDebouncer.processOrBufferMessage(job.data);
    },
    {
      ...bullMQConfig,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Inbound WhatsApp bot message processed');
  });

  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Inbound WhatsApp bot message failed');
  });

  worker.on('error', (error) => {
    logger.error({ error }, 'WhatsApp incoming worker error');
  });

  logger.info('WhatsApp incoming bot worker started');
  return worker;
};
