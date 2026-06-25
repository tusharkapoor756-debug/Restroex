import { ContextService } from '../../ai/services/context.service';
import { OpenRouterService } from '../../ai/services/openrouter.service';

export class AIHandler {

    private readonly contextService: ContextService;
    private readonly ai: OpenRouterService;

    constructor() {
        this.contextService = new ContextService();
        this.ai = new OpenRouterService();
    }

    public async handle(
        restaurantId: string,
        customerMessage: string,
    ): Promise<string> {

        const context =
            await this.contextService.build(
                restaurantId,
                customerMessage,
            );

        return await this.ai.chat(context);

    }

}