import { ContextBuilderService } from './context-builder.service';
import {
    KnowledgeService,
    RestaurantKnowledge,
} from './knowledge.service';

export class ContextService {
    private readonly knowledgeService = new KnowledgeService();
    private readonly contextBuilder = new ContextBuilderService();

    public async build(
        restaurantId: string,
        customerMessage: string,
    ): Promise<string> {

        const knowledge: RestaurantKnowledge =
            await this.knowledgeService.buildKnowledge(
                restaurantId,
            );

        return this.contextBuilder.buildContext({
            restaurant: knowledge.restaurant,
            settings: knowledge.settings,
            menu: knowledge.menu,
            customerMessage,
        });
    }
}