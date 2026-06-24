import { redis } from '../../infrastructure/redis/redis.client';
import { SessionRepository } from './repositories/session.repository';
import { ConversationEngine } from './conversation.engine';
import { ConversationState } from './conversation.states';
import { ConversationSession, FSMEvent } from './types/conversation.types';
import { logger } from '../../infrastructure/logger/logger';

export class SessionService {
  private repository: SessionRepository;
  private engine: ConversationEngine;
  private static readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout

  constructor() {
    this.repository = new SessionRepository();
    this.engine = new ConversationEngine();
  }

  /**
   * Safe execution wrapper that runs FSM actions under a Redis Mutex Lock to serialize processing.
   */
  public async executeSessionAction<T>(
    restaurantId: string,
    customerPhone: string,
    actionFn: (session: ConversationSession) => Promise<{ event: FSMEvent; callback?: (session: ConversationSession) => Promise<T> }>
  ): Promise<T | null> {
    const lockKey = `lock:session:${restaurantId}:${customerPhone}`;
    const redisClient = redis.getClient();
    // Try acquiring lock up to 3 times with back‑off
    let acquired: string | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      acquired = await redisClient.set(lockKey, 'locked', 'PX', 5000, 'NX');
      if (acquired) {
        logger.info({ restaurantId, customerPhone, attempt }, '✅ Session lock acquired');
        break;
      }
      logger.warn({ restaurantId, customerPhone, attempt }, '⚠️ Session lock acquisition failed');
      await new Promise((r) => setTimeout(r, 100 * attempt));
    }
    if (!acquired) {
      // Throw to let caller handle retry via HTTP 500
      throw new Error('Session lock acquisition failed after retries');
    }

    try {
      // 2. Fetch or Create Session
      let session = await this.repository.findSession(restaurantId, customerPhone);
      if (!session) {
        session = await this.repository.createSession(restaurantId, customerPhone);
      }

      // 3. Handle Timeout Check (Inactivity Auto-Reset)
      const lastInteractionTime = new Date(session.lastInteractionAt).getTime();
      const isTimedOut = Date.now() - lastInteractionTime > SessionService.SESSION_TIMEOUT_MS;

      if (isTimedOut && session.state !== ConversationState.IDLE && session.state !== ConversationState.HUMAN_TAKEOVER) {
        logger.info({ phone: customerPhone }, 'Session timed out due to inactivity. Resetting to IDLE.');
        session = await this.repository.updateSession(
          session.id,
          ConversationState.IDLE,
          { items: [] },
          {}
        );
      }

      // 4. Run Business Logic to determine Event
      const { event, callback } = await actionFn(session);

      // 5. Execute FSM Transition and State Mutations
      const { nextState, updatedCart, updatedContext } = this.engine.processEvent(session, event);

      // 6. Persist Updated State to Database
      const updatedSession = await this.repository.updateSession(
        session.id,
        nextState,
        updatedCart,
        updatedContext
      );

      logger.info(
        { from: session.state, to: nextState, event: event.name },
        `FSM State transition complete for ${customerPhone}`
      );

      // 7. Invoke post-transition side effects (e.g. generating order, sending response)
      if (callback) {
        return await callback(updatedSession);
      }

      return null;
    } catch (error: any) {
      logger.error({ error, customerPhone }, 'Error occurred during session FSM action execution');
      throw error;
    } finally {
      // 8. Release Distributed Lock
      await redisClient.del(lockKey);
    }
  }

  /**
   * Manual force reset utility (used for administrative control or manual override)
   */
  public async resetSession(restaurantId: string, customerPhone: string): Promise<ConversationSession> {
    const session = await this.repository.findSession(restaurantId, customerPhone);
    if (!session) {
      throw new Error('No active session found to reset.');
    }
    return await this.repository.updateSession(session.id, ConversationState.IDLE, { items: [] }, {});
  }
}
