import { createApp } from './bootstrap/app';
import { startServer } from './bootstrap/server';
import { logger } from './infrastructure/logger/logger';
import { db } from './infrastructure/database/database.client';
import { redis } from './infrastructure/redis/redis.client';
import { queueRegistry } from './infrastructure/queue';
import { startWhatsAppIncomingWorker } from './infrastructure/queue/workers';
import { whatsappProviderFactory } from './modules/whatsapp/providers/whatsapp-provider.factory';

const run = async () => {
  logger.info('Initializing Restroex Runtime...');

  // Initialize Infrastructure
  try {
    await db.connect();
  } catch (error) {
    logger.warn({ error }, 'Database is unavailable. Starting API in degraded mode.');
  }
  await redis.connect();
  await queueRegistry.initialize();
  startWhatsAppIncomingWorker();
  await restoreWhatsAppSessions();

  const app = createApp();
  await startServer(app);
};

const restoreWhatsAppSessions = async () => {
  try {
    const redisClient = redis.getClient();
    const statusKeys = await redisClient.keys('whatsapp:session:*:status');
    const provider = whatsappProviderFactory.getProvider();

    for (const key of statusKeys) {
      const raw = await redisClient.get(key);
      if (!raw) continue;

      try {
        const status = JSON.parse(raw) as { restaurantId?: string; state?: string };
        if (!status.restaurantId) continue;

        if (status.state === 'connected' || status.state === 'reconnecting') {
          await provider.connectSession(status.restaurantId);
        }
      } catch (error) {
        logger.warn({ key, error }, 'Skipping malformed WhatsApp session status during restore');
      }
    }
  } catch (error) {
    logger.warn({ error }, 'WhatsApp session restore pass failed');
  }
};

run().catch((error) => {
  console.error('Fatal initialization error:', error);
  process.exit(1);
});
