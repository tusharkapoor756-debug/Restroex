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
      // 1. Fetch available menu items for the restaurant tenant
      const supabase = db.getClient();
      const { data: menuData, error } = await supabase
        .from('menu_items')
        .select('id, name, aliases, base_price')
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true);

      if (error) {
        logger.error({ error, restaurantId }, 'Failed to load restaurant menu for parsing. Proceeding with empty menu.');
      }

      const menu: MenuMappingItem[] = (menuData || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        aliases: item.aliases || [],
        basePrice: Number(item.base_price),
      }));

      // 2. Parse using the fast deterministic pipeline
      const result = this.deterministicParser.parseInput(text, menu);

      // 3. Fallback to AI if confidence is low
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
    // Intent detection for common shortcuts before any menu lookup.
    const normalized = text.toLowerCase().trim();
    const greetingSet = new Set(['hello', 'hi', 'hey', 'namaste']);
    const viewMenuSet = new Set(['menu', 'menuu', 'munu']);
    const checkoutSet = new Set(['checkout', 'confirm', 'place order']);

    let intent: ParseResult['intent'] = 'unknown';
    if (greetingSet.has(normalized)) intent = 'unknown'; // greeting treated as unknown (no action)
    else if (viewMenuSet.has(normalized)) intent = 'view_menu';
    else if (checkoutSet.has(normalized)) intent = 'checkout';

    // Return result with no items; confidence set to 1.0 for deterministic fallback.
    return {
      items: [],
      intent,
      overallConfidence: 1.0,
      isFallbackTriggered: false,
      rawInput: text,
    };
  }
}
