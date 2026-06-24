import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';

// Inline simple logger matching standard backend tracing format
const logger = {
  info: (msg: string, meta?: any) => console.log(`[WORKER] [INFO] ${new Date().toISOString()}: ${msg} ${meta ? JSON.stringify(meta) : ''}`),
  warn: (msg: string, meta?: any) => console.warn(`[WORKER] [WARN] ${new Date().toISOString()}: ${msg} ${meta ? JSON.stringify(meta) : ''}`),
  error: (msg: string, err?: any) => console.error(`[WORKER] [ERROR] ${new Date().toISOString()}: ${msg}`, err),
};

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const redisConnection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
});

redisConnection.on('connect', () => logger.info(`✅ Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`));
redisConnection.on('error', (err) => logger.error('❌ Redis connection error', err));

// Initial active workers collection
const activeWorkers: Worker[] = [];

/**
 * 1. WHATSAPP INCOMING WORKER
 * Offloads parsing from API gateways.
 */
const startWhatsAppIncomingWorker = () => {
  const worker = new Worker(
    'whatsapp-incoming',
    async (job: Job) => {
      logger.info(`Processing WhatsApp incoming message job: ${job.id}`, { payload: job.data });
      const { customerPhone, textBody, messageId } = job.data;

      if (!customerPhone || !textBody) {
        throw new Error('Invalid job payload: customerPhone and textBody are mandatory.');
      }

      // Idempotency: simulated check inside worker
      logger.info(`Message parsed successfully. Phone: ${customerPhone}, Body: ${textBody}`);
      return { success: true, processedMessageId: messageId };
    },
    {
      connection: redisConnection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`❌ whatsapp-incoming job failed: ${job?.id}`, err);
  });

  activeWorkers.push(worker);
  logger.info('📦 whatsapp-incoming worker started successfully.');
};

/**
 * 2. AI BACKGROUND WORKER
 * Offloads slow LLM text analysis from main server thread.
 */
const startAIProcessingWorker = () => {
  const worker = new Worker(
    'ai-processing',
    async (job: Job) => {
      logger.info(`Processing AI background parsing job: ${job.id}`);
      const { text, menuItems } = job.data;

      // Simulate heavy asynchronous AI request / Tokenization
      await new Promise((resolve) => setTimeout(resolve, 800));

      logger.info(`AI parsing finalized. Extracted matches for query: "${text}"`);
      return { matchedItems: [{ name: 'Malai Chaap', qty: 1 }] };
    },
    {
      connection: redisConnection,
      concurrency: 5, // Prevent parallel API rate limit locks
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`❌ ai-processing job failed: ${job?.id}`, err);
  });

  activeWorkers.push(worker);
  logger.info('📦 ai-processing worker started successfully.');
};

/**
 * 3. NOTIFICATIONS DELIVERY WORKER
 * Idempotent WhatsApp notification dispatcher. Rate-limited to respect API limits.
 */
const startNotificationsWorker = () => {
  const worker = new Worker(
    'notifications',
    async (job: Job) => {
      logger.info(`Processing notification dispatch: ${job.id}`);
      const { recipient, body } = job.data;

      if (!recipient || !body) {
        throw new Error('Recipient and Body are mandatory parameters.');
      }

      // Simulate sending WhatsApp Business API payload
      logger.info(`📤 Outbound WhatsApp sent successfully to ${recipient}: "${body}"`);
      return { sent: true, timestamp: new Date().toISOString() };
    },
    {
      connection: redisConnection,
      concurrency: 20,
      limiter: {
        max: 50, // Rate limits WhatsApp API calls to 50/sec
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`❌ notifications job failed: ${job?.id}`, err);
  });

  activeWorkers.push(worker);
  logger.info('📦 notifications worker started successfully.');
};

/**
 * 4. ORDER ASYNC PROCESSING WORKER
 * Processes post-paid transactions and triggers kitchen alerts.
 */
const startOrderProcessingWorker = () => {
  const worker = new Worker(
    'order-processing',
    async (job: Job) => {
      logger.info(`Processing Order state transaction callback job: ${job.id}`);
      const { orderId, status } = job.data;

      logger.info(`Order ${orderId} transitioned state hook executed for status: "${status}"`);
      return { success: true };
    },
    {
      connection: redisConnection,
      concurrency: 15,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(`❌ order-processing job failed: ${job?.id}`, err);
  });

  activeWorkers.push(worker);
  logger.info('📦 order-processing worker started successfully.');
};

/**
 * INITIALIZATION & BOOTSTRAP SYSTEM
 */
const bootstrap = async () => {
  logger.info('🚀 Starting Restroex Background Worker Runtime...');

  try {
    startWhatsAppIncomingWorker();
    startAIProcessingWorker();
    startNotificationsWorker();
    startOrderProcessingWorker();

    logger.info('✅ All BullMQ background workers initialized and listening for jobs.');

    // Graceful Shutdown Handling
    const shutdown = async (signal: string) => {
      logger.warn(`⚠️ Received ${signal}. Initializing graceful shutdown process...`);

      const shutdownPromises = activeWorkers.map(async (w) => {
        logger.info(`Closing worker listening to: ${w.name}`);
        await w.close();
      });

      await Promise.all(shutdownPromises);
      await redisConnection.quit();

      logger.info('👋 Graceful shutdown complete. Process exiting.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Fatal initialization crash inside worker runtime', error);
    process.exit(1);
  }
};

// bootstrap();
