import { Request, Response } from 'express';
import { WhatsAppWebhookValidation } from './webhook.validation';
import { logger } from '../../infrastructure/logger/logger';
import { QueueProducer } from '../../infrastructure/queue/producers/queue.producer';
import { QueueName } from '../../infrastructure/queue/types/queue.types';
import { randomUUID } from 'crypto';
import { redis } from '../../infrastructure/redis/redis.client';
import { db } from '../../infrastructure/database/database.client';

export class WhatsAppWebhookController {
  private validation: WhatsAppWebhookValidation;
  private queueProducer: QueueProducer;

  constructor() {
    this.validation = new WhatsAppWebhookValidation();
    this.queueProducer = new QueueProducer(QueueName.WHATSAPP_INCOMING);
  }

  /**
   * GET /api/v1/whatsapp/webhook
   * Verification handshake for WhatsApp Cloud API setup.
   */
  public handleVerification = async (req: Request, res: Response): Promise<void> => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode && token) {
      const isValid = this.validation.verifyToken(mode, token);
      if (isValid) {
        logger.info('✅ WhatsApp Webhook verified successfully.');
        res.status(200).send(challenge);
        return;
      }
    }
    logger.warn('❌ WhatsApp Webhook verification failed.');
    res.sendStatus(403);
  };

  /**
   * POST /api/v1/whatsapp/webhook
   * Inbound WhatsApp Cloud API webhook message receiver.
   */
  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const rawPayload = JSON.stringify(req.body);

      // 1. Verify Webhook Signature for Security
      const isAuthentic = this.validation.verifySignature(rawPayload, signature);
      if (!isAuthentic) {
        logger.warn('❌ Inbound WhatsApp payload failed signature verification.');
        res.sendStatus(401);
        return;
      }

      // 2. Parse payload structure safely
      const entry = req.body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      // Ignore non-message events (e.g., status updates)
      if (!message) {
        res.sendStatus(200);
        return;
      }

      const messageId = message.id;
      const customerPhone = message.from;
      const textBody = message.text?.body?.trim();
      const wabaNumber = value?.metadata?.display_phone_number; // Business phone number

      if (!textBody) {
        // Ignore non-text messages for the pilot
        res.sendStatus(200);
        return;
      }

      logger.info({ messageId, customerPhone, textBody }, '📩 Received inbound WhatsApp message');

      // 3. Prevent Duplicate Message Deliveries (Idempotency Key Check)
      const redisClient = redis.getClient();
      const dedupKey = `processed:msg:${messageId}`;
      const isDuplicate = await redisClient.get(dedupKey);
      if (isDuplicate) {
        logger.warn({ messageId }, '⚠️ Duplicate WhatsApp message received. Skipping processing.');
        res.sendStatus(200);
        return;
      }

      // 4. Resolve Restaurant Tenant using the business phone number
      const supabase = db.getClient();
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id')
        .eq('phone_number', wabaNumber)
        .maybeSingle();

      if (error || !restaurant) {
        logger.error({ wabaNumber, error }, '❌ Tenant lookup failed for WABA business number');
        res.sendStatus(500);
        return;
      }
      const restaurantId = restaurant.id;

      // 5. Enqueue the incoming message for asynchronous processing
      const jobPayload = {
        traceId: randomUUID(),
        timestamp: new Date().toISOString(),
        platform: 'whatsapp' as const,
        restaurantId,
        messageId,
        from: customerPhone,
        textBody,
        content: message,
      };
      await this.queueProducer.addJob('process', jobPayload);

      // 6. Mark as processed after enqueueing
      await redisClient.set(dedupKey, 'true', 'EX', 86400);
      logger.info({ messageId }, '✅ Inbound WhatsApp message enqueued for async handling');
      res.sendStatus(200);
    } catch (err) {
      logger.error({ err }, '❌ Failed to process incoming WhatsApp webhook');
      res.sendStatus(500);
    }
  };
}
