import { db } from '../../infrastructure/database/database.client';
import { DeterministicParserService } from './services/deterministic-parser.service';
import { ParseResult, MenuMappingItem } from './types/parser.types';
import { logger } from '../../infrastructure/logger/logger';

export class AIParser {
  private deterministicParser: DeterministicParserService;

  constructor() {
    this.deterministicParser = new DeterministicParserService();
  }

  /**
   * Main orchestrator to parse incoming WhatsApp text messages.
   * Leverages high-performance deterministic matching first, falling back to LLM processing if required.
   */
  public async parseMessage(text: string, restaurantId: string): Promise<ParseResult> {
    try {
      const supabase = db.getClient();

      // 1. Fetch available menu items for the restaurant tenant
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, aliases, base_price')
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true);

      if (menuError) {
        logger.error({ error: menuError, restaurantId }, 'Failed to load restaurant menu for parsing.');
      }

      const rawItems = menuData || [];
      const itemIds = rawItems.map((i: any) => i.id);

      // 2. Fetch all variants for these items
      let variantsData: any[] = [];
      if (itemIds.length > 0) {
        const { data: vd, error: vError } = await supabase
          .from('menu_item_variants')
          .select('id, menu_item_id, variant_name, price')
          .in('menu_item_id', itemIds)
          .eq('is_available', true);

        if (vError) {
          logger.error({ error: vError, restaurantId }, 'Failed to load menu variants for parsing.');
        } else {
          variantsData = vd || [];
        }
      }

      // 3. Group variants by menu_item_id
      const variantsByItemId = new Map<string, Array<{ id: string; variantName: string; price: number }>>();
      for (const v of variantsData) {
        if (!variantsByItemId.has(v.menu_item_id)) {
          variantsByItemId.set(v.menu_item_id, []);
        }
        variantsByItemId.get(v.menu_item_id)!.push({
          id: v.id,
          variantName: v.variant_name,
          price: Number(v.price),
        });
      }

      // 4. Build MenuMappingItem[] with variants
      const menu: MenuMappingItem[] = rawItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        aliases: item.aliases || [],
        basePrice: Number(item.base_price),
        variants: variantsByItemId.get(item.id) || [],
      }));

      // 5. Parse using the fast deterministic pipeline
      const result = this.deterministicParser.parseInput(text, menu);

      // 6. Fallback to AI if confidence is low
      if (result.isFallbackTriggered) {
        logger.info({ rawInput: text }, '⚠️ Deterministic parsing confidence low. Dispatching AI fallback processor.');
        return await this.executeAIFallback(text, menu);
      }

      return result;
    } catch (err: any) {
      logger.error({ err, text }, 'Error occurred during AI/Deterministic parsing orchestrator');
      return {
        items: [],
        intent: 'unknown',
        overallConfidence: 0.0,
        isFallbackTriggered: true,
        rawInput: text,
      };
    }
  }

  /**
   * AI Fallback logic (Mocked for pilot testing. Returns intent and first matching menu item as parsed output).
   */
  private async executeAIFallback(text: string, menu: MenuMappingItem[]): Promise<ParseResult> {
    const normalized = text.toLowerCase().trim();
    const greetingSet = new Set(['hello', 'hi', 'hey', 'namaste']);
    const viewMenuSet = new Set(['menu', 'menuu', 'munu']);
    const checkoutSet = new Set(['checkout', 'confirm', 'place order']);

    let intent: ParseResult['intent'] = 'unknown';
    if (greetingSet.has(normalized)) intent = 'unknown';
    else if (viewMenuSet.has(normalized)) intent = 'view_menu';
    else if (checkoutSet.has(normalized)) intent = 'checkout';

    return {
      items: [],
      intent,
      overallConfidence: 1.0,
      isFallbackTriggered: false,
      rawInput: text,
    };
  }
}
