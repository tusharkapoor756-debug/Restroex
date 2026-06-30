import { SessionService } from '../conversations/session.service';
import { VariantHandler } from './handlers/variant.handler';
import { RestaurantRepository } from '../restaurants/repositories/restaurant.repository';
import { GreetingHandler } from './handlers/greeting.handler';
import { CartHandler } from './handlers/cart.handler';
import { AIHandler } from './handlers/ai.handler';
import { AiFallbackCartHandler } from './handlers/ai-fallback-cart.handler';
import { CheckoutHandler } from './handlers/checkout.handler';
import { MenuHandler } from './handlers/menu.handler';
import { IntentService, IntentType } from '../ai/services/intent.service';
import { MenuRepository } from '../menu/repositories/menu.repository';
import { DeterministicParserService } from '../ai/services/deterministic-parser.service';
import { WhatsAppMessageService } from './message.service';
import { logger } from '../../infrastructure/logger/logger';
import { db } from '../../infrastructure/database/database.client';
import { MenuMappingItem } from '../ai/types/parser.types';
import { ConversationState } from '../conversations/conversation.states';


interface IncomingWhatsAppPayload {
  restaurantId: string;
  customerPhone: string;
  from: string;
  textBody: string;
}

export class WhatsAppBotReplyService {
  private readonly menuRepository: MenuRepository;
  private readonly restaurantRepository: RestaurantRepository;
  private readonly parser: DeterministicParserService;
  private readonly messages: WhatsAppMessageService;
  private readonly intentService: IntentService;
  private readonly menuHandler: MenuHandler;
  private readonly checkoutHandler: CheckoutHandler;
  private readonly aiHandler: AIHandler;
  private readonly cartHandler: CartHandler;
  private readonly aiFallbackCartHandler: AiFallbackCartHandler;
  private readonly greetingHandler: GreetingHandler;
  private readonly variantHandler: VariantHandler;
  private readonly sessionService: SessionService;

  constructor() {
    this.menuRepository = new MenuRepository();
    this.restaurantRepository = new RestaurantRepository();
    this.parser = new DeterministicParserService();
    this.messages = new WhatsAppMessageService();
    this.intentService = new IntentService();
    this.menuHandler = new MenuHandler();
    this.checkoutHandler = new CheckoutHandler();
    this.aiHandler = new AIHandler();
    this.cartHandler = new CartHandler();
    this.aiFallbackCartHandler = new AiFallbackCartHandler();
    this.greetingHandler = new GreetingHandler();
    this.variantHandler = new VariantHandler();
    this.sessionService = new SessionService();
  }

  public async handleIncomingMessage(payload: IncomingWhatsAppPayload): Promise<void> {
    logger.info({ payload }, 'Enter handleIncomingMessage');
    try {
      const restaurantId = payload.restaurantId;
      const customerPhone = payload.customerPhone || payload.from;
      const text = String(payload.textBody || '').trim();

      if (!restaurantId || !customerPhone || !text) return;

      const session = await this.sessionService.getSession(restaurantId, customerPhone);
      logger.info({ state: session.state }, 'Current Conversation State');

      // ── 1. Load menu with variants (single round-trip) ──────────────────
      const availableMenu = await this.loadMenuWithVariants(restaurantId);
      logger.info({ menuItemsCount: availableMenu.length }, 'After loadMenuWithVariants');

      // ── 1.1 Handle AWAITING_VARIANT state (database-driven resolution) ───
      if (
        session.state === ConversationState.AWAITING_VARIANT &&
        session.context.pendingVariantItemId
      ) {
        const reply = await this.handleAwaitingVariant(
          restaurantId,
          customerPhone,
          text,
          session,
          availableMenu,
        );
        if (reply !== null) {
          await this.messages.sendText(restaurantId, customerPhone, reply);
          return;
        }
        // null = could not handle in variant state → fall through to normal routing
      }

      // ── 2. Detect intent ─────────────────────────────────────────────────
      const intent = await this.intentService.detect(text, availableMenu);
      logger.info({ intent }, 'Detected Intent');

      // ── 3. Try deterministic parser ──────────────────────────────────────
      const parsed = this.parser.parseInput(text, availableMenu);
      logger.info({ parsed }, 'After parser.parseInput');

      let reply: string;

      if (intent.intent === IntentType.GREETING) {
        const restaurant = await this.restaurantRepository.findById(restaurantId);
        reply = this.greetingHandler.handle(restaurant?.name || 'Our Restaurant');

      } else if (intent.intent === IntentType.VIEW_MENU) {
        reply = this.menuHandler.handle(availableMenu);

      } else if (intent.intent === IntentType.CHECKOUT) {
        reply = await this.checkoutHandler.handle(restaurantId, customerPhone);

      } else if (!parsed.isFallbackTriggered && parsed.items.length > 0) {
        // ── Deterministic parser succeeded ──────────────────────────────────
        reply = await this.cartHandler.handle(
          restaurantId,
          customerPhone,
          parsed,
          availableMenu,
          text,
        );

      } else if (
        // ── Deterministic parser failed — try LLM extraction pipeline ───────
        // Only invoke LLM extraction when the intent looks like ordering
        // (ADD_TO_CART from LLM intent detector, or we have an unresolved text)
        intent.intent === IntentType.ADD_TO_CART || intent.intent === IntentType.UNKNOWN
      ) {
        reply = await this.aiFallbackCartHandler.handle(
          restaurantId,
          customerPhone,
          text,
          availableMenu,
        );

      } else {
        // ── General AI response (small talk, knowledge, etc.) ────────────────
        reply = await this.aiHandler.handle(restaurantId, customerPhone, text);
      }

      logger.debug({ reply }, 'Before sending reply');
      await this.messages.sendText(restaurantId, customerPhone, reply);
    } catch (error) {
      logger.error(error, 'BOT REPLY SERVICE FAILED');
    }
  }

  // ─── AWAITING_VARIANT sub-handler ─────────────────────────────────────────

  /**
   * Handles customer replies when conversation state is AWAITING_VARIANT.
   * Matches the customer text against DB variants for the pending item.
   * Returns a reply string if handled, or null to fall through to normal routing.
   */
  private async handleAwaitingVariant(
    restaurantId: string,
    customerPhone: string,
    text: string,
    session: { context: Record<string, any> },
    availableMenu: MenuMappingItem[],
  ): Promise<string | null> {
    const pendingItemId = session.context.pendingVariantItemId as string;
    const pendingItem = availableMenu.find(item => item.id === pendingItemId);

    if (!pendingItem) return null;

    const matchedVariant = pendingItem.variants.find(
      v => v.variantName.toLowerCase() === text.toLowerCase()
    );

    if (matchedVariant) {
      const quantity = (session.context.pendingQuantity as number) ?? 1;

      await this.sessionService.executeSessionAction(
        restaurantId,
        customerPhone,
        async () => ({
          event: {
            name: 'CHOOSE_VARIANT',
            payload: {
              variantId: matchedVariant.id,
              unitPrice: matchedVariant.price,
            },
          },
        }),
      );

      await this.sessionService.executeSessionAction(
        restaurantId,
        customerPhone,
        async () => ({
          event: {
            name: 'SET_QUANTITY',
            payload: { quantity },
          },
        }),
      );

      return `✅ Added ${quantity} x *${pendingItem.name}* (${matchedVariant.variantName}) — ₹${matchedVariant.price} each.\n\nReply with "checkout" to confirm your order or add more items.`;
    }

    // Variant text not matched — re-prompt
    const variantReply = await this.variantHandler.handle(pendingItemId);
    if (variantReply) {
      return `I couldn't find "${text}". Please choose from:\n\n${variantReply}`;
    }

    return null;
  }

  // ─── Menu loader ──────────────────────────────────────────────────────────

  /**
   * Loads available menu items with their variants in a single round-trip.
   * Returns MenuMappingItem[] consumed by both the parser and handlers.
   */
  private async loadMenuWithVariants(restaurantId: string): Promise<MenuMappingItem[]> {
    const supabase = db.getClient();

    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, aliases, base_price')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true);

    if (menuError) {
      logger.error({ error: menuError, restaurantId }, 'Failed to load menu for bot');
      return [];
    }

    const rawItems = menuData || [];
    if (rawItems.length === 0) return [];

    const itemIds = rawItems.map((i: any) => i.id);

    const { data: variantsData, error: vError } = await supabase
      .from('menu_item_variants')
      .select('id, menu_item_id, variant_name, price')
      .in('menu_item_id', itemIds)
      .eq('is_available', true);

    if (vError) {
      logger.error({ error: vError, restaurantId }, 'Failed to load variants for bot');
    }

    const variantsByItemId = new Map<string, Array<{ id: string; variantName: string; price: number }>>();
    for (const v of (variantsData || []) as any[]) {
      if (!variantsByItemId.has(v.menu_item_id)) {
        variantsByItemId.set(v.menu_item_id, []);
      }
      variantsByItemId.get(v.menu_item_id)!.push({
        id: v.id,
        variantName: v.variant_name,
        price: Number(v.price),
      });
    }

    return rawItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      aliases: item.aliases || [],
      basePrice: item.base_price !== null && item.base_price !== undefined
        ? Number(item.base_price)
        : null,
      variants: variantsByItemId.get(item.id) || [],
    }));
  }
}
