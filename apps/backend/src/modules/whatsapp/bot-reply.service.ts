import { MenuRepository } from '../menu/repositories/menu.repository';
import { DeterministicParserService } from '../ai/services/deterministic-parser.service';
import { WhatsAppMessageService } from './message.service';
import { QueueProducer } from '../../infrastructure/queue/producers/queue.producer';
import { logger } from '../../infrastructure/logger/logger';
import { OrderService } from '../orders/services/order.service';
import { SessionService } from '../conversations/session.service';
import { ConversationState } from '../conversations/conversation.states';


interface IncomingWhatsAppPayload {
  restaurantId: string;
  customerPhone: string;
  from: string;
  textBody: string;
}

export class WhatsAppBotReplyService {
  private readonly menuRepository: MenuRepository;
  private readonly parser: DeterministicParserService;
  private readonly messages: WhatsAppMessageService;
  private readonly orderService: OrderService;
  private readonly sessionService: SessionService;

  constructor() {
    this.menuRepository = new MenuRepository();
    this.parser = new DeterministicParserService();
    this.messages = new WhatsAppMessageService();
    this.orderService = new OrderService();
    this.sessionService = new SessionService();
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
        .filter(item => item.isAvailable)
        .map(item => ({
          id: item.id,
          name: item.name,
          aliases: item.aliases,
          basePrice: item.basePrice,
        }));

      // 2. Parse input
      const parsed = this.parser.parseInput(text, availableMenu);
      logger.info({ parsed }, 'After parser.parseInput');

      let reply: string;

      if (['hi', 'hello', 'hey', 'namaste'].includes(text.toLowerCase())) {
        reply = this.buildWelcomeReply();
      } else if (text.toLowerCase() === 'menu' || parsed.intent === 'view_menu') {
        reply = this.buildMenuReply(availableMenu);
      } else if (parsed.intent === 'add_to_cart' && parsed.items.length > 0 && !parsed.isFallbackTriggered) {
        logger.info('Before add_to_cart branch');

        // Session transition
        logger.info('Before sessionService.executeSessionAction (transition)');
        await this.sessionService.executeSessionAction(
          restaurantId,
          customerPhone,
          async (session) => {
            if (session.state === ConversationState.IDLE) {
              return { event: { name: 'START_ORDER' } };
            } else if (session.state === ConversationState.AWAITING_CONFIRMATION) {
              return { event: { name: 'ADD_MORE' } };
            }
            return { event: { name: 'ADD_MORE' } };
          },
        );
        logger.info('After sessionService.executeSessionAction (transition)');
        logger.info('STEP_B');

        // Persist items
        let persistedCount = 0;
        logger.info({ parsedItems: parsed.items }, 'STEP_C');
        for (const item of parsed.items) {
          if (!item.matchedMenuItemId) continue;
          const menuItem = availableMenu.find(m => m.id === item.matchedMenuItemId);
          const price = menuItem ? menuItem.basePrice : 0;

          await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async (session) => ({
              event: {
                name: 'ITEM_ADDED',
                payload: {
                  menuItemId: item.matchedMenuItemId!,
                  quantity: item.quantity,
                  unitPrice: price,
                },
              },
            }),
          );
          persistedCount++;
        }

        if (persistedCount === 0) {
          reply = this.buildFallbackReply();
        } else {
          reply = this.buildAddToCartReply(parsed.items);
        }
      } else if (parsed.intent === 'checkout' || text.toLowerCase() === 'confirm') {
        // Checkout flow…
        const cart = await this.sessionService.executeSessionAction(
          restaurantId,
          customerPhone,
          async (session) => ({
            event: { name: 'PROCEED_TO_CHECKOUT' },
            callback: async (updatedSession) => updatedSession.cart,
          }),
        );

        if (!cart || (cart.items?.length ?? 0) === 0) {
          reply = this.buildEmptyCartReply();
        } else {
          const idempotencyKey = `${restaurantId}-${customerPhone}-${Date.now()}`;
          const order = await this.orderService.checkoutOrder(restaurantId, customerPhone, cart, idempotencyKey);
          await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async (session) => ({ event: { name: 'RESET' } }),
          );
          reply = this.buildCheckoutReply(order.id);
        }
      } else {
        reply = this.buildFallbackReply();
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
