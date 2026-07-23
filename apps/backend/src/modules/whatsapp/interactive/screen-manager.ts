import { CompactPayload, InteractiveScreen } from './interactive-action.types';
import { InteractiveHomeHandler } from './handlers/home.handler';
import { InteractiveBrowseHandler } from './handlers/browse.handler';
import { InteractiveCartHandler } from './handlers/cart.handler';
import { InteractiveCheckoutHandler } from './handlers/checkout.handler';
import { InteractiveRecommendationHandler } from './handlers/recommendation.handler';
import { InteractiveOfferHandler } from './handlers/offer.handler';
import { InteractiveSearchHandler } from './handlers/search.handler';
import { InteractiveNavigationHandler } from './handlers/navigation.handler';
import { SessionService } from '../../conversations/session.service';

export class ScreenManager {
  private homeHandler = new InteractiveHomeHandler();
  private browseHandler = new InteractiveBrowseHandler();
  private cartHandler = new InteractiveCartHandler();
  private checkoutHandler = new InteractiveCheckoutHandler();
  private recommendationHandler = new InteractiveRecommendationHandler();
  private offerHandler = new InteractiveOfferHandler();
  private searchHandler = new InteractiveSearchHandler();
  private navigationHandler = new InteractiveNavigationHandler();

  public async buildScreen(
    restaurantId: string,
    restaurantName: string,
    customerPhone: string,
    payload: CompactPayload
  ): Promise<InteractiveScreen> {
    let screen: InteractiveScreen;

    // Handle back button navigation
    if (payload.a === 'back') {
      const prevScreenRaw = await this.navigationHandler.popScreen(restaurantId, customerPhone);
      if (prevScreenRaw) {
        try {
          // If the popped screen is a serialized action payload
          const parsed = JSON.parse(prevScreenRaw);
          return this.buildScreen(restaurantId, restaurantName, customerPhone, parsed);
        } catch {
          // poppped simple screen ID
          payload = { a: prevScreenRaw as any };
        }
      } else {
        payload = { a: 'home' };
      }
    }

    switch (payload.a) {
      case 'home':
        screen = await this.homeHandler.render(restaurantId, restaurantName);
        await this.navigationHandler.clearStack(restaurantId, customerPhone);
        break;

      case 'browse':
        screen = await this.browseHandler.renderCategories(restaurantId, payload.p || 1);
        break;

      case 'category':
        if (!payload.id) throw new Error('Category ID is required for browse screen');
        screen = await this.browseHandler.renderCategoryItems(restaurantId, payload.id, payload.p || 1);
        break;

      case 'item':
        if (!payload.id) throw new Error('Item ID is required for item detail');
        screen = await this.browseHandler.renderItemDetail(restaurantId, payload.id);
        break;

      case 'variant':
        if (!payload.id || !payload.vid) throw new Error('Item and Variant ID required');
        screen = await this.browseHandler.renderVariantDetail(restaurantId, payload.id, payload.vid);
        break;

      case 'quantity':
        if (!payload.id) throw new Error('Item ID required for quantity configuration');
        // Mutate cart
        const addedMsg = await this.cartHandler.addToCart(
          restaurantId,
          customerPhone,
          payload.id,
          payload.vid,
          payload.q || 1
        );
        // Show cart view after mutation
        screen = await this.cartHandler.renderCart(restaurantId, customerPhone);
        screen.body = `${addedMsg}\n\n${screen.body}`;
        break;

      case 'cart_view':
        screen = await this.cartHandler.renderCart(restaurantId, customerPhone);
        break;

      case 'cart_clear':
        const clearedMsg = await this.cartHandler.clearCart(restaurantId, customerPhone);
        screen = await this.cartHandler.renderCart(restaurantId, customerPhone);
        screen.body = `${clearedMsg}\n\n${screen.body}`;
        break;

      case 'checkout':
        screen = await this.checkoutHandler.execute(restaurantId, customerPhone);
        break;

      case 'best_sellers':
        screen = await this.recommendationHandler.renderBestSellers(restaurantId);
        break;

      case 'offers':
        screen = await this.offerHandler.renderOffers(restaurantId);
        break;

      case 'track_order':
        screen = {
          id: 'track_order',
          title: '📦 Track Order',
          body: 'We are preparing your order. You will receive updates directly on WhatsApp.',
          buttons: [{ id: JSON.stringify({ a: 'home' }), title: '🏠 Back to Home' }],
          previousScreenId: 'home',
        };
        break;

      case 'talk_to_staff':
        // Move state to takeover
        const sessionService = new SessionService();
        await sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'TRIGGER_TAKEOVER' },
        }));
        screen = {
          id: 'talk_to_staff',
          title: '☎️ Connecting...',
          body: 'We are connecting you with a restaurant agent. They will reply shortly. Please type your message below.',
          buttons: [{ id: JSON.stringify({ a: 'home' }), title: '🏠 Cancel & Go Home' }],
        };
        break;

      default:
        // Default to home screen
        screen = await this.homeHandler.render(restaurantId, restaurantName);
        break;
    }

    // Record navigation stack trace (except back itself)
    if (payload.a !== 'back') {
      const serialized = JSON.stringify(payload);
      await this.navigationHandler.pushScreen(restaurantId, customerPhone, serialized);
    }

    return screen;
  }
}
export const screenManager = new ScreenManager();
