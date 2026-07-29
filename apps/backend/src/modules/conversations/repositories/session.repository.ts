import { db } from '../../../infrastructure/database/database.client';
import { ConversationSession } from '../types/conversation.types';
import { ConversationState } from '../conversation.states';
import { logger } from '../../../infrastructure/logger/logger';

export class SessionRepository {
  private get client() {
    return db.getClient();
  }

  /**
   * Finds an active conversation session by tenant ID and customer phone number.
   */
  public async findSession(restaurantId: string, customerPhone: string): Promise<ConversationSession | null> {
    const { data, error } = await this.client
      .from('conversation_sessions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('customer_phone', customerPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find conversation session: ${error.message}`);
    }

    if (!data) return null;

    return this.mapToDomain(data);
  }

  /**
   * Creates a new conversation session.
   */
  public async createSession(restaurantId: string, customerPhone: string): Promise<ConversationSession> {
    const newSession = {
      restaurant_id: restaurantId,
      customer_phone: customerPhone,
      state: ConversationState.IDLE,
      cart: { items: [] },
      context: {},
      last_interaction_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('conversation_sessions')
      .insert(newSession)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create conversation session: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Updates an existing conversation session's state, cart, and context.
   */
  public async updateSession(
    id: string,
    state: ConversationState,
    cart: any,
    context: any
  ): Promise<ConversationSession> {

    logger.debug(
      {
        state,
        cart,
        context,
      },
      'SESSION BEFORE DB UPDATE',
    );
    // Fallback for database check constraint if migration 00022 hasn't been executed on DB
    let dbState = state as string;
    if (dbState === 'awaiting_order_mode' || dbState === 'awaiting_table_number') {
      dbState = 'awaiting_confirmation';
    }

    const { data, error } = await this.client
      .from('conversation_sessions')
      .update({
        state: dbState,
        cart,
        context,
        last_interaction_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    logger.debug(
      {
        data,
        error,
      },
      'SESSION AFTER DB UPDATE',
    );

    if (error) {
      throw new Error(`Failed to update conversation session: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Patches only the context field of an existing session.
   * Used by the Interactive Engine for navigation stack / screen state without triggering FSM.
   */
  public async patchContext(
    restaurantId: string,
    customerPhone: string,
    contextPatch: Record<string, any>
  ): Promise<void> {
    // First fetch current session to merge context
    const current = await this.findSession(restaurantId, customerPhone);
    if (!current) return;

    const mergedContext = {
      ...current.context,
      ...contextPatch,
    };

    await this.client
      .from('conversation_sessions')
      .update({
        context: mergedContext,
        last_interaction_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurantId)
      .eq('customer_phone', customerPhone);
  }

  /**
   * Map database row to domain interface.
   */
  private mapToDomain(row: any): ConversationSession {
    let domainState = row.state as ConversationState;

    // Granular state reconstruction if DB contains awaiting_confirmation fallback
    if (domainState === ('awaiting_confirmation' as any)) {
      if (!row.context?.orderType) {
        domainState = ConversationState.AWAITING_ORDER_MODE;
      } else if (row.context?.orderType === 'dining' && row.context?.tableNumber === undefined) {
        domainState = ConversationState.AWAITING_TABLE_NUMBER;
      }
    }

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      customerPhone: row.customer_phone,
      state: domainState,
      cart: row.cart,
      context: row.context,
      lastInteractionAt: row.last_interaction_at.endsWith('Z') ? row.last_interaction_at : `${row.last_interaction_at}Z`,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
