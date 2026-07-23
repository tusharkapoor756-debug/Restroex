// ContextService — legacy stub, not used in the production pipeline.
// Retained to avoid deletion churn. Detached from ContextBuilderService
// after Phase 2 rewrote the context-builder contract.

import {
    KnowledgeService,
    RestaurantKnowledge,
} from './knowledge.service';

export class ContextService {
    private readonly knowledgeService = new KnowledgeService();

    public async build(
        restaurantId: string,
        customerMessage: string,
    ): Promise<string> {
        const knowledge: RestaurantKnowledge =
            await this.knowledgeService.buildKnowledge(
                restaurantId,
            );

        const menuText = knowledge.menu?.length
            ? knowledge.menu
                .map((item: any) => `• ${item.name} - ₹${item.basePrice}`)
                .join('\n')
            : 'No menu available';

        return `Restaurant: ${knowledge.restaurant?.name || 'Unknown'}\nMenu:\n${menuText}\nMessage: ${customerMessage}`;
    }
}