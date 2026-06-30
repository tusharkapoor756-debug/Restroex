import { DeterministicParserService } from './deterministic-parser.service';
import { OpenRouterService } from './openrouter.service';

export enum IntentType {
    GREETING = 'GREETING',

    VIEW_MENU = 'VIEW_MENU',

    ADD_TO_CART = 'ADD_TO_CART',

    REMOVE_FROM_CART = 'REMOVE_FROM_CART',

    UPDATE_CART = 'UPDATE_CART',

    CHECKOUT = 'CHECKOUT',

    ASK_KNOWLEDGE = 'ASK_KNOWLEDGE',

    SMALL_TALK = 'SMALL_TALK',

    UNKNOWN = 'UNKNOWN',
}

export interface IntentResult {
    intent: IntentType;
    confidence: number;
    source: 'deterministic' | 'llm';
}

export class IntentService {

    private readonly parser = new DeterministicParserService();

    private readonly ai = new OpenRouterService();

    public async detect(
        message: string,
        menu: any[],
    ): Promise<IntentResult> {

        const text = message.trim().toLowerCase();

        // =========================
        // GREETING
        // =========================

        if (
            ['hi', 'hello', 'hey', 'namaste']
                .some(word => text.includes(word))
        ) {
            return {
                intent: IntentType.GREETING,
                confidence: 1,
                source: 'deterministic',
            };
        }

        // =========================
        // MENU
        // =========================

        if (
            text.includes('menu') ||
            text.includes('card')
        ) {
            return {
                intent: IntentType.VIEW_MENU,
                confidence: 0.98,
                source: 'deterministic',
            };
        }

        // =========================
        // ADD TO CART
        // =========================

        const parsed = this.parser.parseInput(
            message,
            menu,
        );

        if (
            parsed.intent === 'add_to_cart' &&
            parsed.items.length > 0
        ) {
            return {
                intent: IntentType.ADD_TO_CART,
                confidence: 0.95,
                source: 'deterministic',
            };
        }

        // =========================
        // CHECKOUT
        // =========================

        if (
            [
                'checkout',
                'confirm',
                'confirm order',
                'place order',
                'order',
                'done',
                'yes',
                'bill',
                'pay',
                'payment'
            ].some(word => text.includes(word))
        ) {
            return {
                intent: IntentType.CHECKOUT,
                confidence: 0.98,
                source: 'deterministic',
            };
        }

        // =========================
        // LLM FALLBACK
        // =========================

        const llmIntent =
            await this.ai.detectIntent(
                message,
            );

        return {
            intent: llmIntent,
            confidence: 0.75,
            source: 'llm',
        };
    }
}