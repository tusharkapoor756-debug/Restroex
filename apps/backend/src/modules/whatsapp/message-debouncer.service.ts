import { redis } from '../../infrastructure/redis/redis.client';
import { logger } from '../../infrastructure/logger/logger';
import { WhatsAppBotReplyService } from './bot-reply.service';

export interface IncomingMessagePayload {
  restaurantId: string;
  customerPhone: string;
  from: string;
  textBody: string;
  interactivePayload?: string;
  content?: any;
  mediaId?: string | null;
  mediaType?: string | null;
}

export class MessageDebouncerService {
  private readonly botReplyService = new WhatsAppBotReplyService();
  private readonly activeTimers = new Map<string, NodeJS.Timeout>();
  private readonly DEFAULT_DEBOUNCE_MS = 2000;
  private readonly FAST_FLUSH_MS = 500;

  /**
   * Enqueues an incoming message fragment into customer's debouncing buffer.
   * Schedules a single aggregated execution turn when the debounce window expires.
   */
  public async processOrBufferMessage(payload: IncomingMessagePayload): Promise<void> {
    const { restaurantId, customerPhone, textBody, interactivePayload } = payload;
    const sessionKey = `${restaurantId}:${customerPhone}`;
    const bufferKey = `debounce:buffer:${sessionKey}`;
    const redisClient = redis.getClient();

    const textToStore = textBody.trim() || interactivePayload || '';
    if (!textToStore && !payload.mediaId) return;

    logger.info({ restaurantId, customerPhone, textToStore }, '📥 Debouncer: Message fragment received');

    // 1. Append message text to Redis buffer list
    if (textToStore) {
      await redisClient.rpush(bufferKey, textToStore);
      await redisClient.expire(bufferKey, 60); // Safety TTL 60s
    }

    // 2. Check if an active debouncing timer is already running for this customer
    if (this.activeTimers.has(sessionKey)) {
      logger.info({ sessionKey }, '⏳ Debouncer: Appended message to active buffer window');
      return;
    }

    // 3. Smart Adaptive Delay Calculation:
    // Fast flush (400ms) if:
    //   - Interactive button payload or single digit selection
    //   - Message ends with punctuation (. ! ?)
    //   - Message length >= 4 words (e.g. "Hi, I want 1 Paneer Butter Masala")
    //   - Matches clear intent keywords (menu, cart, checkout, bill)
    // Standard window (2000ms) for short ambiguous fragments ("bhai", "haan", "1 piece")
    const isCompleteThought = this.isCompleteThought(textToStore, interactivePayload);
    const delayMs = isCompleteThought ? 400 : this.DEFAULT_DEBOUNCE_MS;

    logger.info({ sessionKey, textToStore, isCompleteThought, delayMs }, '⏱️ Debouncer: Starting aggregation window');

    // 4. Schedule flush after delayMs
    const timer = setTimeout(async () => {
      this.activeTimers.delete(sessionKey);
      await this.flushBuffer(payload);
    }, delayMs);

    this.activeTimers.set(sessionKey, timer);
  }

  /**
   * Evaluates if a message fragment represents a complete thought suitable for fast flush.
   */
  private isCompleteThought(text: string, interactivePayload?: string): boolean {
    if (interactivePayload) return true;
    const trimmed = text.trim();
    if (!trimmed) return true;

    // Trailing punctuation (. ! ?) signifies complete sentence
    if (/[.!?]$/.test(trimmed)) return true;

    // Word count >= 4 signifies a complete sentence request
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= 4) return true;

    // Explicit command keywords
    const INTENT_KEYWORDS = ['menu', 'cart', 'checkout', 'bill', 'order', 'help', 'cancel', 'clear'];
    if (INTENT_KEYWORDS.includes(trimmed.toLowerCase())) return true;

    return false;
  }

  /**
   * Flushes customer message buffer, combines fragments into 1 text body, and executes FSM pipeline turn.
   */
  private async flushBuffer(basePayload: IncomingMessagePayload): Promise<void> {
    const { restaurantId, customerPhone } = basePayload;
    const sessionKey = `${restaurantId}:${customerPhone}`;
    const bufferKey = `debounce:buffer:${sessionKey}`;
    const redisClient = redis.getClient();

    try {
      // Fetch all buffered text items and delete buffer list atomically
      const items = await redisClient.lrange(bufferKey, 0, -1);
      await redisClient.del(bufferKey);

      if (!items || items.length === 0) {
        if (basePayload.textBody || basePayload.interactivePayload) return;
      }

      // Combine multiple message bubbles with newlines
      const combinedText = items.length > 0 ? items.join('\n') : basePayload.textBody;

      logger.info(
        { sessionKey, itemCount: items.length, combinedText },
        '🚀 Debouncer Flushed: Dispatching single combined message payload to FSM'
      );

      const combinedPayload: IncomingMessagePayload = {
        ...basePayload,
        textBody: combinedText,
      };

      // Execute single turn under existing Redis pipeline lock
      await this.botReplyService.handleIncomingMessage(combinedPayload);
    } catch (err) {
      logger.error({ err, sessionKey }, '❌ Debouncer flush execution failed');
    }
  }
}

export const messageDebouncer = new MessageDebouncerService();
