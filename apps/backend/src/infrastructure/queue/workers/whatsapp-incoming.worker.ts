import { Worker } from 'bullmq';
import { bullMQConfig } from '../bullmq.config';
import { QueueName } from '../types/queue.types';
import { logger } from '../../logger/logger';
import { WhatsAppBotReplyService } from '../../../modules/whatsapp/bot-reply.service';

let worker: Worker | null = null;

export const startWhatsAppIncomingWorker = (): Worker => {
  if (worker) return worker;

  const bot = new WhatsAppBotReplyService();

  worker = new Worker(
    QueueName.WHATSAPP_INCOMING,
    async (job) => {
      logger.info({ jobId: job.id, data: job.data }, 'Processing inbound WhatsApp bot message');
      logger.info('BEFORE handleIncomingMessage');
      await bot.handleIncomingMessage(job.data);
      logger.info('AFTER handleIncomingMessage');
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
