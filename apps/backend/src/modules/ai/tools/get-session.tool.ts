import { Tool, ToolContext } from '../types/tools.types';
import { SessionRepository } from '../../conversations/repositories/session.repository';

export class GetSessionTool implements Tool<void, any> {
  public readonly definition = {
    name: 'get_session',
    description: 'Retrieves the current conversation session state for the customer, including state name and context details.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  private readonly sessionRepository: SessionRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
  }

  public async execute(args: void, context: ToolContext): Promise<any> {
    const session = await this.sessionRepository.findSession(context.restaurantId, context.customerPhone);
    if (!session) {
      return { state: 'IDLE', context: {} };
    }
    return {
      id: session.id,
      state: session.state,
      context: session.context,
      lastInteractionAt: session.lastInteractionAt,
    };
  }
}
