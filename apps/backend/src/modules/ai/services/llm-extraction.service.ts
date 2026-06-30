import OpenAI from 'openai';
import { logger } from '../../../infrastructure/logger/logger';
import { MenuMappingItem } from '../types/parser.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LlmExtractedItem {
  /** Raw item name as the customer intended — no price, no variant resolution */
  itemName: string;
  /** Optional variant name the customer mentioned (e.g. "Full", "Large") */
  variant?: string;
  quantity: number;
}

export type LlmExtractionIntent =
  | 'ADD_TO_CART'
  | 'CHECKOUT'
  | 'VIEW_MENU'
  | 'GREETING'
  | 'UNKNOWN';

export interface LlmExtractionResult {
  intent: LlmExtractionIntent;
  /** Populated only when intent === 'ADD_TO_CART' */
  items: LlmExtractedItem[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * LlmExtractionService — uses the LLM ONLY as a structured data extraction engine.
 *
 * CONTRACT:
 *  - Input:  raw customer text + available menu (names only, NO prices)
 *  - Output: { intent, items[] } — never customer-facing prose
 *  - The LLM is strictly forbidden from resolving prices, variants, or IDs.
 *    All of that is done by the backend after extraction.
 */
export class LlmExtractionService {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Extracts structured intent and items from the customer's message.
   * Returns null if the LLM response cannot be parsed as valid JSON.
   *
   * IMPORTANT: The LLM receives item names only — no prices, no variant details.
   *            Pricing is resolved by the backend after this call.
   */
  public async extractItems(
    customerText: string,
    menu: MenuMappingItem[],
  ): Promise<LlmExtractionResult | null> {
    // Build a menu catalogue string — names and aliases only, NO prices
    const menuCatalogue = menu
      .map((item) => {
        const aliases = item.aliases.length > 0 ? ` (also known as: ${item.aliases.join(', ')})` : '';
        const variantNames = item.variants.length > 0
          ? ` [variants: ${item.variants.map(v => v.variantName).join(', ')}]`
          : '';
        return `- ${item.name}${aliases}${variantNames}`;
      })
      .join('\n');

    const systemPrompt = `You are a food order extraction engine.

TASK: Extract the customer's intent and items from their message.

MENU (use ONLY these item names — do not invent items not listed):
${menuCatalogue}

OUTPUT FORMAT: You MUST respond with ONLY valid JSON. No explanation, no markdown, no prose.

SCHEMA:
{
  "intent": "ADD_TO_CART" | "CHECKOUT" | "VIEW_MENU" | "GREETING" | "UNKNOWN",
  "items": [
    {
      "itemName": "<exact name from the menu above>",
      "variant": "<variant name if mentioned, else omit this field>",
      "quantity": <number, default 1>
    }
  ]
}

RULES:
- intent must be one of the exact strings above.
- items must only contain names that appear in the MENU above.
- If no items match, return items: []
- Do NOT include prices, IDs, or any other fields.
- Do NOT generate customer-facing text.
- Do NOT invent menu items.
- quantity must be a positive integer.
- If the customer did not specify a quantity, default to 1.`;

    try {
      const response = await this.client.chat.completions.create({
        model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: customerText },
        ],
      });

      const rawContent = response.choices[0]?.message?.content?.trim() ?? '';
      logger.debug({ rawContent }, 'LlmExtractionService raw response');

      // Strip markdown code fences if present
      const jsonStr = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const parsed = JSON.parse(jsonStr) as LlmExtractionResult;

      // Validate shape
      if (!parsed.intent || !Array.isArray(parsed.items)) {
        logger.warn({ parsed }, 'LlmExtractionService: invalid shape in response');
        return null;
      }

      // Normalize intent to known enum
      const validIntents: LlmExtractionIntent[] = ['ADD_TO_CART', 'CHECKOUT', 'VIEW_MENU', 'GREETING', 'UNKNOWN'];
      if (!validIntents.includes(parsed.intent as LlmExtractionIntent)) {
        parsed.intent = 'UNKNOWN';
      }

      // Sanitize items — remove any that don't have a string itemName
      parsed.items = parsed.items
        .filter((item) => typeof item.itemName === 'string' && item.itemName.trim().length > 0)
        .map((item) => ({
          itemName: String(item.itemName).trim(),
          variant: item.variant ? String(item.variant).trim() : undefined,
          quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        }));

      return parsed;
    } catch (err) {
      logger.error({ err, customerText }, 'LlmExtractionService: failed to extract or parse JSON');
      return null;
    }
  }
}
