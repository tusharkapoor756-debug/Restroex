import { VariantHandler } from './variant.handler';
import { SessionService } from '../../conversations/session.service';
import { ConversationState } from '../../conversations/conversation.states';
import { AIHandler } from './ai.handler';
import { MenuMappingItem, MenuVariantMappingItem, ParseResult } from '../../ai/types/parser.types';
import { LlmExtractedItem } from '../../ai/services/llm-extraction.service';
import { logger } from '../../../infrastructure/logger/logger';

export class CartHandler {

    private readonly sessionService: SessionService;
    private readonly aiHandler: AIHandler;
    private readonly variantHandler: VariantHandler;

    constructor() {
        this.sessionService = new SessionService();
        this.aiHandler = new AIHandler();
        this.variantHandler = new VariantHandler();
    }

    /**
     * Primary entry point — handles a successfully deterministic-parsed result.
     * All items in `parsed` already have a `matchedMenuItemId` and optionally a `matchedVariantId`.
     */
    public async handle(
        restaurantId: string,
        customerPhone: string,
        parsed: ParseResult,
        availableMenu: MenuMappingItem[],
        customerMessage: string,
    ): Promise<string> {

        // Transition FSM to order-in-progress state
        await this.transitionToOrderState(restaurantId, customerPhone);

        let persistedCount = 0;

        for (const item of parsed.items) {

            if (!item.matchedMenuItemId) {
                continue;
            }

            const menuItem = availableMenu.find(m => m.id === item.matchedMenuItemId);

            // ── Needs variant clarification ──────────────────────────────────
            if (item.needsVariant) {
                const itemName = menuItem?.name ?? item.itemName;

                await this.sessionService.executeSessionAction(
                    restaurantId,
                    customerPhone,
                    async () => ({
                        event: {
                            name: 'NEED_VARIANT',
                            payload: {
                                menuItemId: item.matchedMenuItemId,
                                itemName,
                                quantity: item.quantity,
                                customization: item.customization,
                            },
                        },
                    }),
                );

                const variantReply = await this.variantHandler.handle(item.matchedMenuItemId!);
                if (variantReply) {
                    return variantReply;
                }
                // Race-condition fallback: no variants in DB — fall through to base-price add
            }

            // ── Resolve pricing — all prices come from the database ──────────
            const { unitPrice, variantId } = this.resolvePrice(item, menuItem);

            if (unitPrice === null) {
                // Item has no base price and no variant — cannot add
                logger.warn({ item }, 'CartHandler: cannot determine price for item — skipping');
                continue;
            }

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
                            variantId,
                        },
                    },
                }),
            );

            persistedCount++;
        }

        if (persistedCount === 0) {
            // Nothing was persisted — let AI respond as a fallback
            return await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
        }

        // Confirmed item(s) added — let AI generate the confirmation
        return await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
    }

    /**
     * Secondary entry point — handles a single item resolved from LLM extraction.
     * Called after the AI extraction + menu-matching pipeline resolves a real item/variant/price.
     *
     * The caller has already performed menu + variant resolution and passed us the final resolved IDs
     * and the final price from the database. This method ONLY persists to the cart and generates
     * the confirmation reply.
     *
     * @param restaurantId - restaurant tenant ID
     * @param customerPhone - customer's phone number
     * @param resolvedItem - item as resolved by the backend (all IDs and price from DB)
     * @param customerMessage - original raw message (used to generate AI confirmation)
     */
    public async addResolvedItem(
        restaurantId: string,
        customerPhone: string,
        resolvedItem: {
            menuItemId: string;
            menuItemName: string;
            variantId?: string;
            variantName?: string;
            quantity: number;
            /** Price fetched from DB: variant.price OR menu_items.base_price */
            unitPrice: number;
        },
        customerMessage: string,
    ): Promise<string> {

        // Transition FSM
        await this.transitionToOrderState(restaurantId, customerPhone);

        // Persist cart item
        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async () => ({
                event: {
                    name: 'ITEM_ADDED',
                    payload: {
                        menuItemId: resolvedItem.menuItemId,
                        quantity: resolvedItem.quantity,
                        unitPrice: resolvedItem.unitPrice,
                        variantId: resolvedItem.variantId,
                    },
                },
            }),
        );

        // Generate confirmation via AI (cart is already updated at this point)
        return await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async transitionToOrderState(restaurantId: string, customerPhone: string): Promise<void> {
        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async (session) => {
                if (session.state === ConversationState.IDLE) {
                    return { event: { name: 'START_ORDER' } };
                }
                return { event: { name: 'ADD_MORE' } };
            },
        );
    }

    private resolvePrice(
        item: { matchedVariantId?: string; variantPrice?: number; needsVariant?: boolean },
        menuItem: MenuMappingItem | undefined,
    ): { unitPrice: number | null; variantId: string | undefined } {

        if (item.matchedVariantId && item.variantPrice !== undefined) {
            // Variant matched → use absolute variant price from DB
            return { unitPrice: item.variantPrice, variantId: item.matchedVariantId };
        }

        // No variant → use base_price
        const basePrice = menuItem?.basePrice ?? null;
        return { unitPrice: basePrice, variantId: undefined };
    }
}