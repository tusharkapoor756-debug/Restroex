import OpenAI from 'openai';
import { IntentType } from './intent.service';

export class OpenRouterService {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }

    public async chat(context: string): Promise<string> {
        try {
            const response = await this.client.chat.completions.create({
                model: process.env.AI_MODEL || 'openai/gpt-oss-120b:free',
                temperature: 0.3,
                max_tokens: 200,
                messages: [
                    {
                        role: 'system',
                        content:
                            `You are an AI restaurant assistant.

Follow the restaurant context exactly.

Never invent menu items.
Never invent prices.
Never invent restaurant information.

If something is missing politely say you don't know.`,
                    },
                    {
                        role: 'user',
                        content: context,
                    },
                ],
            });

            return (
                response.choices[0]?.message?.content?.trim() ??
                'Sorry, no response.'
            );

        } catch (error) {

            console.error('OpenRouter Chat Error:', error);

            return 'Sorry, I am having some technical issues right now.';
        }
    }

    public async detectIntent(
        message: string,
    ): Promise<IntentType> {

        try {

            const response =
                await this.client.chat.completions.create({

                    model:
                        process.env.AI_MODEL ||
                        'openai/gpt-oss-120b:free',

                    temperature: 0,

                    max_tokens: 20,

                    messages: [
                        {
                            role: 'system',
                            content: `
Return ONLY ONE WORD.

GREETING
VIEW_MENU
ADD_TO_CART
REMOVE_FROM_CART
UPDATE_CART
CHECKOUT
ASK_KNOWLEDGE
SMALL_TALK
UNKNOWN

No explanation.
No markdown.
No JSON.
Only one word.
`,
                        },
                        {
                            role: 'user',
                            content: message,
                        },
                    ],
                });

            const intent =
                response.choices[0]?.message?.content
                    ?.trim()
                    ?.toUpperCase();

            if (
                intent &&
                Object.values(IntentType).includes(
                    intent as IntentType,
                )
            ) {
                return intent as IntentType;
            }

            return IntentType.UNKNOWN;

        } catch (err) {

            console.error(
                'Intent Detection Error',
                err,
            );

            return IntentType.UNKNOWN;
        }
    }
}