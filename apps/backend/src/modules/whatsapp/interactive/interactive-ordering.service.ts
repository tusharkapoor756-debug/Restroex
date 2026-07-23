import { CompactPayload } from './interactive-action.types';
import { screenManager } from './screen-manager';
import { ReplyBuilder } from './reply-builder';
import { WhatsAppMessageService } from '../message.service';
import { SessionService } from '../../conversations/session.service';
import { SessionRepository } from '../../conversations/repositories/session.repository';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { logger } from '../../../infrastructure/logger/logger';

export class InteractiveOrderingService {
  private messageService = new WhatsAppMessageService();
  private sessionService = new SessionService();
  private sessionRepository = new SessionRepository();
  private restaurantRepo = new RestaurantRepository();

  /**
   * Primary entry point to process a deterministic button or list click.
   */
  public async handleInteractiveClick(
    restaurantId: string,
    customerPhone: string,
    payload: CompactPayload
  ): Promise<void> {
    try {
      const restaurant = await this.restaurantRepo.findById(restaurantId);
      const restaurantName = restaurant?.name || 'Our Restaurant';

      // 1. Build the next screen dynamically
      const screen = await screenManager.buildScreen(
        restaurantId,
        restaurantName,
        customerPhone,
        payload
      );

      // 2. Format reply as numbered text menu (whatsapp-web.js fallback)
      const { text, optionsMap } = ReplyBuilder.buildTextFallback(screen);

      // 3. Persist the options map in session context for matching on next text reply
      await this.sessionRepository.patchContext(restaurantId, customerPhone, {
        lastInteractiveScreen: {
          id: screen.id,
          options: optionsMap,
        },
      });

      // 4. Send message
      await this.messageService.sendText(restaurantId, customerPhone, text);
    } catch (error) {
      logger.error({ error, restaurantId, customerPhone }, 'Interactive message processing failed');
      await this.messageService.sendText(
        restaurantId,
        customerPhone,
        'Something went wrong. Reply *home* to start over, or type your order directly.'
      );
    }
  }

  /**
   * Checks if an incoming plain-text message matches a simulated numbered option
   * from the last interactive screen. Returns the matching CompactPayload or null.
   */
  public async matchTextToInteractiveOption(
    restaurantId: string,
    customerPhone: string,
    text: string
  ): Promise<CompactPayload | null> {
    try {
      const session = await this.sessionService.getSession(restaurantId, customerPhone);
      const lastScreen = session.context.lastInteractiveScreen;

      if (!lastScreen || !lastScreen.options) {
        return null;
      }

      const cleanText = text.trim().toLowerCase();

      const matched = lastScreen.options.find(
        (opt) => opt.key === cleanText
      );

      if (matched) {
        logger.info({ cleanText, matchedPayload: matched.payload }, '🎯 Text matched to interactive option');
        return matched.payload as CompactPayload;
      }

      // Global shortcut keywords
      if (['home', 'start', 'hi', 'hello', 'namaste'].includes(cleanText)) {
        return { a: 'home' };
      }
      if (['cart', 'view cart', 'my cart'].includes(cleanText)) {
        return { a: 'cart_view' };
      }
      if (['menu', 'browse'].includes(cleanText)) {
        return { a: 'browse', p: 1 };
      }

      return null;
    } catch (error) {
      logger.error({ error }, 'Failed to match text option to interactive payload');
      return null;
    }
  }
}

export const interactiveOrderingService = new InteractiveOrderingService();
