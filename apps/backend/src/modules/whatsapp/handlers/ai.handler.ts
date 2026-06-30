import { OrderContextService } from '../../ai/services/order-context.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { OpenRouterService } from '../../ai/services/openrouter.service';

export class AIHandler {

    private readonly orderContext: OrderContextService;
    private readonly promptBuilder: PromptBuilderService;
    private readonly ai: OpenRouterService;

    constructor() {
        this.orderContext = new OrderContextService();
        this.promptBuilder = new PromptBuilderService();
        this.ai = new OpenRouterService();
    }

    public async handle(
        restaurantId: string,
        customerPhone: string,
        customerMessage: string,
    ): Promise<string> {

        const dynamicContext =
            await this.orderContext.build(
                restaurantId,
                customerPhone,
                customerMessage,
            );

        const prompt =
            this.promptBuilder.build(
                dynamicContext,
            );

        return await this.ai.chat(
            prompt,
        );

    }

}