import { CompactPayload } from './interactive-action.types';
import { screenManager } from './screen-manager';
import { ReplyBuilder } from './reply-builder';
import { WhatsAppMessageService } from '../message.service';
import { SessionService } from '../../conversations/session.service';
import { SessionRepository } from '../../conversations/repositories/session.repository';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { logger } from '../../../infrastructure/logger/logger';

export class InteractiveOrderingService {
  private get messageService(): any {
    const { WhatsAppMessageService } = require('../message.service');
    return new WhatsAppMessageService();
  }
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

      // 1. Build the next screen dynamically based on current FSM state
      const screen = await screenManager.buildScreen(
        restaurantId,
        restaurantName,
        customerPhone,
        payload
      );

      // 2. Single Source of Truth: Format reply text & generate option map
      const { text, optionsMap } = ReplyBuilder.buildTextFallback(screen);

      // 3. MANDATORY STRICT STEP: Persist options map to session context BEFORE sending WhatsApp message!
      // Flow: State updated -> Screen generated -> Session committed -> Message sent
      await this.sessionRepository.patchContext(restaurantId, customerPhone, {
        lastInteractiveScreen: {
          id: screen.id,
          options: optionsMap,
        },
      });

      logger.info(
        { restaurantId, customerPhone, screenId: screen.id, optionsCount: optionsMap.length, optionsMap },
        '💾 [Lifecycle 3/4] Screen object persisted into session context'
      );

      // 4. Send message after persistence commit succeeds
      await this.messageService.sendText(restaurantId, customerPhone, text);
    } catch (error: any) {
      logger.error({ error, message: error?.message, stack: error?.stack, restaurantId, customerPhone }, 'Interactive message processing failed');
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

      if (!lastScreen) {
        return null;
      }

      const cleanText = text.trim().toLowerCase();

      logger.info(
        {
          restaurantId,
          customerPhone,
          screenId: lastScreen.id,
          options: lastScreen.options,
          inputText: cleanText,
        },
        '⚙️ [Lifecycle 4/4] Screen object used by Interactive Engine'
      );

      // ─────────────────────────────────────────────────────────────────────
      // SCREEN TYPE A — Quantity Input Prompt Screen
      // ─────────────────────────────────────────────────────────────────────
      if (lastScreen.id && lastScreen.id.startsWith('quantity_prompt_')) {
        // Only allow Back option if explicitly on the current screen's options
        const backMatch = lastScreen.options?.find((opt: any) => opt.key === cleanText && (opt.key === 'b' || opt.key === 'back'));
        if (backMatch) {
          return backMatch.payload as CompactPayload;
        }

        // Validate positive whole integer input for Quantity Prompt screen
        const parsedQty = parseInt(cleanText, 10);
        const isValidInteger = /^\d+$/.test(cleanText) && !isNaN(parsedQty) && parsedQty > 0;

        if (isValidInteger) {
          // Extract context from current screen's optionsMap context_holder
          const contextHolder = lastScreen.options?.find((opt: any) => opt.key === 'context_holder');
          const itemPayload = contextHolder?.payload || lastScreen.options?.[0]?.payload || {};
          const itemId = itemPayload.id || lastScreen.id.replace('quantity_prompt_', '');
          const variantId = itemPayload.vid;

          logger.info({ itemId, variantId, qty: parsedQty }, '🔢 Quantity input matched for current active screen');
          return {
            a: 'quantity',
            id: itemId,
            vid: variantId,
            q: parsedQty,
          };
        } else {
          // Validation failed on Quantity screen — return invalid_quantity to re-render Quantity prompt
          logger.warn({ text: cleanText }, '⚠️ Invalid input for quantity prompt screen');
          return {
            a: 'invalid_quantity',
          };
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // SCREEN TYPE B — Option Screen (Numbered Cards / Buttons)
      // ─────────────────────────────────────────────────────────────────────
      if (!lastScreen.options || lastScreen.options.length === 0) {
        return null;
      }

      // Strictly match text ONLY against current screen's registered optionsMap
      const matched = lastScreen.options.find(
        (opt: any) => opt.key === cleanText && opt.key !== 'context_holder'
      );

      if (matched) {
        logger.info({ cleanText, matchedPayload: matched.payload, screenId: lastScreen.id }, '🎯 Text matched to current active screen option');
        return matched.payload as CompactPayload;
      }

      // Input does not belong to current active screen options
      return null;
    } catch (error) {
      logger.error({ error }, 'Failed to match text option to interactive payload');
      return null;
    }
  }
}

export const interactiveOrderingService = new InteractiveOrderingService();
