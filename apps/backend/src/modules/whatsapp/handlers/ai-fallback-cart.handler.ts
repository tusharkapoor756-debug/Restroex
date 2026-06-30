import { LlmExtractionService } from '../../ai/services/llm-extraction.service';
import { VariantHandler } from './variant.handler';
import { CartHandler } from './cart.handler';
import { AIHandler } from './ai.handler';
import { MenuMappingItem } from '../../ai/types/parser.types';
import { logger } from '../../../infrastructure/logger/logger';
import { SessionService } from '../../conversations/session.service';
import { ConversationState } from '../../conversations/conversation.states';

/**
 * AiFallbackCartHandler
 *
 * Handles the add-to-cart flow when the deterministic parser was unable to resolve
 * the customer's message with sufficient confidence.
 *
 * Architecture:
 *   1. Call LLM ONLY as a JSON extraction engine (no customer-facing text).
 *   2. Match the extracted item name against the menu repository (names + aliases).
 *   3. If item has variants, match the extracted variant against DB variants.
 *   4. Resolve price exclusively from the database.
 *   5. Persist to cart via CartHandler.addResolvedItem() → SessionService.
 *   6. Only after cart is updated does AI generate the customer-facing confirmation.
 *
 * Invariants:
 *   - LLM NEVER sets prices.
 *   - LLM NEVER writes to the cart.
 *   - All cart mutations go through CartHandler → SessionService → ConversationEngine.
 */
export class AiFallbackCartHandler {

    private readonly extractor: LlmExtractionService;
    private readonly cartHandler: CartHandler;
    private readonly variantHandler: VariantHandler;
    private readonly aiHandler: AIHandler;
    private readonly sessionService: SessionService;

    constructor() {
        this.extractor = new LlmExtractionService();
        this.cartHandler = new CartHandler();
        this.variantHandler = new VariantHandler();
        this.aiHandler = new AIHandler();
        this.sessionService = new SessionService();
    }

    /**
     * Attempts to handle a message that the deterministic parser could not confidently parse.
     *
     * @returns A customer-facing reply string (either confirmation or clarification).
     */
    public async handle(
        restaurantId: string,
        customerPhone: string,
        customerMessage: string,
        availableMenu: MenuMappingItem[],
    ): Promise<string> {

        logger.info({ customerMessage }, 'AiFallbackCartHandler: entering LLM extraction path');

        // ── Step 1: LLM Extraction (JSON only) ───────────────────────────────
        const extraction = await this.extractor.extractItems(customerMessage, availableMenu);

        if (!extraction) {
            logger.warn({ customerMessage }, 'AiFallbackCartHandler: LLM extraction returned null — falling back to free-text AI');
            return await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
        }

        logger.info({ extraction }, 'AiFallbackCartHandler: extraction result');

        // ── Step 2: Route by intent ───────────────────────────────────────────
        if (extraction.intent !== 'ADD_TO_CART' || extraction.items.length === 0) {
            // Not an add-to-cart intent — let the free-text AI handle it
            logger.info({ intent: extraction.intent }, 'AiFallbackCartHandler: non-cart intent — routing to AIHandler');
            return await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
        }

        // ── Step 3: Resolve each extracted item against the menu ──────────────
        const replies: string[] = [];

        for (const extracted of extraction.items) {
            const reply = await this.resolveAndAdd(
                restaurantId,
                customerPhone,
                extracted,
                availableMenu,
                customerMessage,
            );
            replies.push(reply);
        }

        // Return the last reply (which is the AI confirmation after cart update)
        return replies[replies.length - 1] ?? await this.aiHandler.handle(restaurantId, customerPhone, customerMessage);
    }

    // ─── Private: item resolution pipeline ───────────────────────────────────

    private async resolveAndAdd(
        restaurantId: string,
        customerPhone: string,
        extracted: { itemName: string; variant?: string; quantity: number },
        availableMenu: MenuMappingItem[],
        customerMessage: string,
    ): Promise<string> {

        // Step 3a: Match item name against menu (names + aliases)
        const matchedItem = this.matchMenuItemByName(extracted.itemName, availableMenu);

        if (!matchedItem) {
            logger.info({ extractedName: extracted.itemName }, 'AiFallbackCartHandler: item not found in menu');
            return this.buildNotFoundReply(extracted.itemName, availableMenu);
        }

        logger.info({ matchedItem: matchedItem.name }, 'AiFallbackCartHandler: menu item matched');

        const hasVariants = matchedItem.variants.length > 0;

        // Step 3b: No variants → add directly at base price
        if (!hasVariants) {
            const basePrice = matchedItem.basePrice;
            if (basePrice === null) {
                logger.warn({ item: matchedItem.name }, 'AiFallbackCartHandler: item has no base price and no variants');
                return `Sorry, the item "${matchedItem.name}" is not currently priced. Please contact the restaurant.`;
            }

            return await this.cartHandler.addResolvedItem(
                restaurantId,
                customerPhone,
                {
                    menuItemId: matchedItem.id,
                    menuItemName: matchedItem.name,
                    quantity: extracted.quantity,
                    unitPrice: basePrice,
                },
                customerMessage,
            );
        }

        // Step 3c: Item has variants
        if (extracted.variant) {
            // Customer specified a variant — match against DB variants (case-insensitive)
            const matchedVariant = matchedItem.variants.find(
                v => v.variantName.toLowerCase() === extracted.variant!.toLowerCase()
            );

            if (matchedVariant) {
                return await this.cartHandler.addResolvedItem(
                    restaurantId,
                    customerPhone,
                    {
                        menuItemId: matchedItem.id,
                        menuItemName: matchedItem.name,
                        variantId: matchedVariant.id,
                        variantName: matchedVariant.variantName,
                        quantity: extracted.quantity,
                        unitPrice: matchedVariant.price,
                    },
                    customerMessage,
                );
            }
            // Variant mentioned but not matched — fall through to clarification
        }

        // Step 3d: Item has variants and none was matched — ask for clarification
        const itemName = matchedItem.name;

        // Transition to order state (IDLE -> AWAITING_ITEM) first
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

        // Then call NEED_VARIANT to transition AWAITING_ITEM -> AWAITING_VARIANT
        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async () => ({
                event: {
                    name: 'NEED_VARIANT',
                    payload: {
                        menuItemId: matchedItem.id,
                        itemName,
                        quantity: extracted.quantity,
                    },
                },
            }),
        );

        const variantReply = await this.variantHandler.handle(matchedItem.id);
        if (variantReply) {
            return variantReply;
        }

        // Edge-case: variants were in DB but VariantHandler returned null (race)
        // Fall back to base price if it exists, otherwise report error
        if (matchedItem.basePrice !== null) {
            return await this.cartHandler.addResolvedItem(
                restaurantId,
                customerPhone,
                {
                    menuItemId: matchedItem.id,
                    menuItemName: matchedItem.name,
                    quantity: extracted.quantity,
                    unitPrice: matchedItem.basePrice,
                },
                customerMessage,
            );
        }

        return `I couldn't find the variant for "${matchedItem.name}". Please reply with a valid variant.`;
    }

    /**
     * Fuzzy name + alias matching — case-insensitive, trimmed.
     * Exact match takes priority over partial/alias match.
     */
    private matchMenuItemByName(
        itemName: string,
        menu: MenuMappingItem[],
    ): MenuMappingItem | undefined {
        const normalized = itemName.trim().toLowerCase();

        // 1. Exact name match
        const exact = menu.find(item => item.name.toLowerCase() === normalized);
        if (exact) return exact;

        // 2. Alias match
        const aliasMatch = menu.find(item =>
            item.aliases.some(alias => alias.toLowerCase() === normalized)
        );
        if (aliasMatch) return aliasMatch;

        // 3. Partial match (item name contains the extracted text, or vice versa)
        const partialMatches = menu.filter(item =>
            item.name.toLowerCase().includes(normalized) ||
            normalized.includes(item.name.toLowerCase())
        );

        if (partialMatches.length === 1) return partialMatches[0];

        return undefined;
    }

    private buildNotFoundReply(itemName: string, menu: MenuMappingItem[]): string {
        const suggestions = menu.slice(0, 3).map(item => `• ${item.name}`).join('\n');
        return [
            `Sorry, I couldn't find "${itemName}" on our menu.`,
            '',
            'Here are some items you might like:',
            suggestions,
            '',
            'Type "menu" to see the full menu, or try again with the exact item name.',
        ].join('\n');
    }
}
