import { SessionService } from '../../conversations/session.service';
import { ConversationState } from '../../conversations/conversation.states';
import { AIHandler } from './ai.handler';

export class CartHandler {

    private readonly sessionService: SessionService;

    private readonly aiHandler: AIHandler;

    constructor() {
        this.sessionService = new SessionService();
        this.aiHandler = new AIHandler();
    }

    public async handle(
        restaurantId: string,
        customerPhone: string,
        parsed: any,
        availableMenu: any[],
        customerMessage: string,
    ): Promise<string> {

        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async (session) => {

                if (session.state === ConversationState.IDLE) {
                    return {
                        event: {
                            name: 'START_ORDER',
                        },
                    };
                }

                return {
                    event: {
                        name: 'ADD_MORE',
                    },
                };

            },
        );

        let persistedCount = 0;

        for (const item of parsed.items) {

            if (!item.matchedMenuItemId) {
                continue;
            }

            const menuItem = availableMenu.find(
                x => x.id === item.matchedMenuItemId,
            );

            const unitPrice =
                menuItem?.basePrice ?? 0;

            await this.sessionService.executeSessionAction(
                restaurantId,
                customerPhone,
                async () => ({

                    event: {

                        name: 'ITEM_ADDED',

                        payload: {

                            menuItemId: item.matchedMenuItemId,

                            quantity: item.quantity,

                            unitPrice,

                        },

                    },

                }),
            );

            persistedCount++;

        }

        return await this.aiHandler.handle(
            restaurantId,
            customerMessage,
        );

    }

}