import { startWhatsAppIncomingWorker } from './src/infrastructure/queue/workers/whatsapp-incoming.worker';
import { QueueProducer } from './src/infrastructure/queue/producers/queue.producer';
import { QueueName } from './src/infrastructure/queue/types/queue.types';
import { logger } from './src/infrastructure/logger/logger';

(async () => {
  // Start the BullMQ worker (singleton)
  startWhatsAppIncomingWorker();

  const producer = new QueueProducer(QueueName.WHATSAPP_INCOMING);
  // Enqueue a message resembling an inbound WhatsApp 'menu' request
  const payload = {
    restaurantId: 'test-restaurant',
    customerPhone: '1234567890',
    from: '1234567890@c.us',
    messageId: `msg-${Date.now()}`,
    textBody: 'menu',
  };

  await producer.add('incoming-message', payload);
  logger.info({ payload }, 'Enqueued test menu message');

  // Give the worker some time to process (adjust as needed)
  await new Promise((resolve) => setTimeout(resolve, 5000));
  logger.info('Test script completed');
  process.exit(0);
})();
