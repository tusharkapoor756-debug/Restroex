import { Tool, ToolContext } from '../types/tools.types';
import { conversationMemoryService } from '../services/conversation-memory.service';

interface GetRecentHistoryArgs {
  limit?: number;
}

export class GetRecentHistoryTool implements Tool<GetRecentHistoryArgs, any> {
  public readonly definition = {
    name: 'get_recent_history',
    description: 'Retrieves the recent conversation history messages between the user and the assistant.',
    parameters: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of recent messages to return (default: 10)',
        },
      },
      required: [],
    },
  };

  public async execute(args: GetRecentHistoryArgs, context: ToolContext): Promise<any> {
    const limit = args?.limit || 10;
    const history = await conversationMemoryService.getRecentConversation(
      context.restaurantId,
      context.customerPhone,
      limit
    );
    return {
      messages: history.map((h) => ({
        role: h.role,
        message: h.message,
        timestamp: h.timestamp || new Date().toISOString(),
      })),
    };
  }
}
