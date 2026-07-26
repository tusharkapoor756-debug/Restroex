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
   * Serializes the execution of the entire inbound message processing pipeline for a customer.
   */
  public async runPipelineLocked<T>(
    restaurantId: string,
    customerPhone: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const lockKey = `lock:pipeline:${restaurantId}:${customerPhone}`;
    const redisClient = redis.getClient();
    let acquired: string | null = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      acquired = await redisClient.set(lockKey, 'locked', 'PX', 30000, 'NX');
      if (acquired) {
        logger.info({ restaurantId, customerPhone, attempt }, '✅ Pipeline lock acquired');
        break;
      }
      logger.warn({ restaurantId, customerPhone, attempt }, '⚠️ Pipeline lock failed, retrying...');
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
    if (!acquired) {
      throw new Error(`Pipeline lock acquisition failed after retries for customer ${customerPhone}`);
    }
    try {
      return await fn();
    } finally {
      await redisClient.del(lockKey);
      logger.info({ restaurantId, customerPhone }, '🔓 Pipeline lock released');
    }
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
      // NOTE: Onboarding and recovery states are intentionally excluded from timeout reset.
      // These are user-driven flows (waiting for name / address / recovery choice) and
      // should never be wiped mid-flow by an automated timer.
      const TIMEOUT_EXEMPT_STATES: ConversationState[] = [
        ConversationState.IDLE,
        ConversationState.HUMAN_TAKEOVER,
        ConversationState.AWAITING_NAME,
        ConversationState.AWAITING_ADDRESS,
        ConversationState.AWAITING_PROFILE_CONFIRMATION,
        ConversationState.AWAITING_RECOVERY,
      ];
      const lastInteractionTime = new Date(session.lastInteractionAt).getTime();
      const isTimedOut = Date.now() - lastInteractionTime > SessionService.SESSION_TIMEOUT_MS;

      if (isTimedOut && !TIMEOUT_EXEMPT_STATES.includes(session.state)) {
        logger.info({ phone: customerPhone }, 'Session timed out due to inactivity. Resetting conversation state to IDLE but preserving cart.');
        session = await this.repository.updateSession(
          session.id,
          ConversationState.IDLE,
          session.cart,
          {}
        );
      }

      // 4. Run Business Logic to determine Event
      const { event, callback } = await actionFn(session);

      // 5. Execute FSM Transition and State Mutations
      const { nextState, updatedCart, updatedContext } = this.engine.processEvent(session, event);

      logger.info({ point: 1, updatedCartFromEngine: updatedCart }, '🔍 [DIAGNOSTIC 1] updatedCart returned by ConversationEngine');
      logger.info({ point: 2, updatedCartToRepository: updatedCart }, '🔍 [DIAGNOSTIC 2] updatedCart passed into updateSession()');

      // 6. Persist Updated State to Database
      const updatedSession = await this.repository.updateSession(
        session.id,
        nextState,
        updatedCart,
        updatedContext
      );

      logger.info({ point: 3, conversationSessionsCartDb: updatedSession.cart }, '🔍 [DIAGNOSTIC 3] conversation_sessions.cart immediately after updateSession()');

      // Sync with customer_carts table
      try {
        const { cartService: innerCartService } = require('./services/cart.service');
        const dbCart = await innerCartService.getOrCreateActiveCart(restaurantId, customerPhone);
        
        if (event.name === 'RESET') {
          // Keep old cart as abandoned, rather than wiping it
          await innerCartService.updateStatus(dbCart.id, 'abandoned');
        } else {
          // Sync items
          await innerCartService.updateItems(dbCart.id, updatedCart.items);
          const syncedDbCart = await innerCartService.getActiveCart(restaurantId, customerPhone);
          logger.info({ point: 4, customerCartsItemsDb: syncedDbCart?.items }, '🔍 [DIAGNOSTIC 4] customer_carts.items immediately after updateItems()');

          // Sync status
          let nextCartStatus: any = 'active';
          if (nextState === ConversationState.AWAITING_CONFIRMATION) {
            nextCartStatus = 'checkout_pending';
          } else if (nextState === ConversationState.AWAITING_PAYMENT_SCREENSHOT || nextState === ConversationState.AWAITING_PAYMENT) {
            nextCartStatus = 'payment_pending';
          } else if (nextState === ConversationState.PAYMENT_COMPLETED) {
            nextCartStatus = 'completed';
          }
          await innerCartService.updateStatus(dbCart.id, nextCartStatus);
        }
      } catch (err) {
        logger.error({ err, customerPhone }, 'Failed to sync session cart with customer_carts table');
      }

      const freshSession = await this.getSession(restaurantId, customerPhone);
      logger.info({ point: 5, getSessionCart: freshSession.cart }, '🔍 [DIAGNOSTIC 5] session returned by getSession()');

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
    return await this.repository.updateSession(
      session.id,
      ConversationState.IDLE,
      { items: [] },

      {}

    );

  } public async getSession(
    restaurantId: string,
    customerPhone: string,
  ): Promise<ConversationSession> {

    let session =
      await this.repository.findSession(
        restaurantId,
        customerPhone,
      );

    if (!session) {

      session =
        await this.repository.createSession(
          restaurantId,
          customerPhone,
        );

    }

    return session;

  }
}
