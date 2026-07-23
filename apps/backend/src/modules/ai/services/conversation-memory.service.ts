import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';

export interface MemoryMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp: string;
  restaurantId: string;
  customerPhone: string;
}

export class ConversationMemoryService {
  /**
   * Saves a message (user or assistant) to the conversation history.
   */
  public async saveMessage(
    restaurantId: string,
    customerPhone: string,
    role: 'user' | 'assistant',
    message: string
  ): Promise<void> {
    try {
      const { error } = await db.getClient()
        .from('conversation_history')
        .insert({
          restaurant_id: restaurantId,
          customer_phone: customerPhone,
          role,
          message,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error({ error, restaurantId, customerPhone, role }, 'Failed to save conversation message');
      } else {
        logger.debug({ restaurantId, customerPhone, role }, 'Saved conversation message to memory');
      }
    } catch (err) {
      logger.error({ err, restaurantId, customerPhone, role }, 'Unexpected error saving conversation message');
    }
  }

  /**
   * Retrieves the last N recent conversation messages, ordered chronologically (oldest to newest).
   *
   * @param restaurantId  - Isolation tenant restaurant ID
   * @param customerPhone - Isolation customer phone
   * @param limit         - Max messages to retrieve (default: 10)
   */
  public async getRecentConversation(
    restaurantId: string,
    customerPhone: string,
    limit: number = 10
  ): Promise<MemoryMessage[]> {
    try {
      const { data, error } = await db.getClient()
        .from('conversation_history')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('customer_phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error({ error, restaurantId, customerPhone }, 'Failed to fetch conversation history');
        return [];
      }

      if (!data) return [];

      // Map rows and reverse so that oldest messages are first (chronological order)
      const messages: MemoryMessage[] = data.map((row: any) => ({
        role: row.role,
        message: row.message,
        timestamp: row.created_at,
        restaurantId: row.restaurant_id,
        customerPhone: row.customer_phone
      }));

      return messages.reverse();
    } catch (err) {
      logger.error({ err, restaurantId, customerPhone }, 'Unexpected error fetching conversation history');
      return [];
    }
  }

  // ─── Future Expansion Placeholders ─────────────────────────────────────────

  /**
   * Future Expansion: Generates/updates a rolling summary of the conversation
   * to compress context.
   */
  public async updateRollingSummary(
    restaurantId: string,
    customerPhone: string
  ): Promise<void> {
    // To be implemented in a future phase
  }

  /**
   * Future Expansion: Stores semantic/long-term memory.
   */
  public async saveLongTermMemory(
    restaurantId: string,
    customerPhone: string,
    key: string,
    value: string
  ): Promise<void> {
    // To be implemented in a future phase
  }
}
export const conversationMemoryService = new ConversationMemoryService();
