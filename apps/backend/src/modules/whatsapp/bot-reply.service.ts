import { RestaurantRepository } from '../restaurants/repositories/restaurant.repository';
import { GreetingHandler } from './handlers/greeting.handler';
import { CartHandler } from './handlers/cart.handler';
import { AIHandler } from './handlers/ai.handler';
import { CheckoutHandler } from './handlers/checkout.handler';
import { MenuHandler } from './handlers/menu.handler';
import { IntentService, IntentType } from '../ai/services/intent.service';
import { MenuRepository } from '../menu/repositories/menu.repository';
import { DeterministicParserService } from '../ai/services/deterministic-parser.service';
import { WhatsAppMessageService } from './message.service';
import { logger } from '../../infrastructure/logger/logger';


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
  private readonly greetingHandler: GreetingHandler;
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
    this.greetingHandler = new GreetingHandler();
  }

  public async handleIncomingMessage(payload: IncomingWhatsAppPayload): Promise<void> {
    logger.info({ payload }, 'Enter handleIncomingMessage');
    try {
      const restaurantId = payload.restaurantId;
      const customerPhone = payload.customerPhone || payload.from;
      const text = String(payload.textBody || '').trim();

      if (!restaurantId || !customerPhone || !text) return;

      // 1. Fetch menu
      const menuItems = await this.menuRepository.listByRestaurant(restaurantId);
      logger.info({ menuItemsCount: menuItems.length }, 'After menuRepository.listByRestaurant');

      const availableMenu = menuItems
        .filter((item: any) => item.isAvailable)
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          aliases: item.aliases,
          basePrice: item.basePrice,
        }));



      const intent = await this.intentService.detect(
        text,
        availableMenu,
      );

      logger.info(
        {
          intent,
        },
        'Detected Intent',
      );
      // 2. Parse input
      const parsed = this.parser.parseInput(text, availableMenu);
      logger.info({ parsed }, 'After parser.parseInput');

      let reply: string;
      if (intent.intent === IntentType.GREETING) {

        const restaurant =
          await this.restaurantRepository.findById(
            restaurantId,
          );

        reply = this.greetingHandler.handle(
          restaurant?.name || 'Our Restaurant',
        );

      }
      else if (
        intent.intent === IntentType.VIEW_MENU
      ) {
        reply = this.menuHandler.handle(
          availableMenu,
        );
      }
      else if (parsed.intent === 'add_to_cart' && parsed.items.length > 0 && !parsed.isFallbackTriggered) {
        reply = await this.cartHandler.handle(
          restaurantId,
          customerPhone,
          parsed,
          availableMenu,
          text,
        );
      }
      else if (
        intent.intent === IntentType.CHECKOUT
      ) {

        reply = await this.checkoutHandler.handle(
          restaurantId,
          customerPhone,
        );
      } else {

        reply = await this.aiHandler.handle(
          restaurantId,
          text,
        );

      }
      logger.debug({ reply }, 'Before sending reply');
      await this.messages.sendText(restaurantId, customerPhone, reply);
    } catch (error) {
      logger.error(error, 'BOT REPLY SERVICE FAILED');
    }
  }

  private buildWelcomeReply(): string {
    return [
      'Namaste! Restroex bot ready.',
      'Send an item like "2 malai chaap full" or type "menu" to see options.',
    ].join('\n');
  }

  private buildMenuReply(menuItems: Array<{ name: string; basePrice: number }>): string {
    return ['Menu:', this.buildShortMenu(menuItems)].join('\n\n');
  }

  private buildAddToCartReply(items: Array<{ itemName: string; quantity: number; variantName?: string; customization?: string }>): string {
    const lines = items.map((item, index) => {
      const variant = item.variantName ? ` ${item.variantName}` : '';
      const customization = item.customization ? ` (${item.customization})` : '';
      return `${index + 1}. ${item.quantity} x ${item.itemName}${variant}${customization}`;
    });
    return [
      '✅ Added to cart',
      '',
      ...lines,
      '',
      'Cart Summary:',
      ...lines,
      '',
      'Type "checkout" to place order or send more items.',
    ].join('\n');
  }



  private buildCheckoutReply(orderId: string): string {
    return `✅ Order placed!\nID: ${orderId}\nThank you for ordering with Restroex!`;
  }
  private buildFallbackReply(): string {
    return [
      'Mujhe samajhne mein thodi dikkat hui 😊',
      "Aap menu dekhne ke liye 'menu' bhej sakte hain ya item ka naam bhej sakte hain.",
    ].join('\n');
  }


  private buildShortMenu(menuItems: Array<{ name: string; basePrice: number }>): string {
    if (menuItems.length === 0) {
      return 'Menu abhi setup nahi hua hai. Restaurant staff se contact karein.';
    }

    return menuItems
      .slice(0, 12)
      .map((item, index) => `${index + 1}. ${item.name} - Rs ${Number(item.basePrice).toFixed(2)}`)
      .join('\n');
  }
  private buildEmptyCartReply(): string {
    return [
      '🛒 Your cart is empty.',
      "Send an item like '2 malai chaap full' or type 'menu' to see what's available.",
    ].join('\n');
  }
}
