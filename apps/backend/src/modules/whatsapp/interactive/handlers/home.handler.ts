import { InteractiveScreen } from '../interactive-action.types';
import { WhatsAppConfigRepository } from '../../../restaurants/repositories/whatsapp-config.repository';
import { CartService } from '../../../conversations/services/cart.service';

export class InteractiveHomeHandler {
  private configRepo = new WhatsAppConfigRepository();
  private cartService = new CartService();

  public async render(restaurantId: string, restaurantName: string, customerPhone?: string): Promise<InteractiveScreen> {
    const config = await this.configRepo.getByRestaurantId(restaurantId);
    
    let cartNotice = '';
    const buttons: Array<{ id: string; title: string }> = [];

    // Check if active cart exists for customer
    if (customerPhone) {
      const activeCart = await this.cartService.getActiveCart(restaurantId, customerPhone).catch(() => null);
      if (activeCart && activeCart.items && activeCart.items.length > 0) {
        const totalCount = activeCart.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const totalPrice = activeCart.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
        cartNotice = `🛒 *Cart Active:* ${totalCount} item(s) (₹${totalPrice})\n\n`;

        // Inject high priority cart action as option 1
        buttons.push({
          id: JSON.stringify({ a: 'cart_view' }),
          title: '🛒 View Cart',
        });
      }
    }

    const bodyLines = [
      `Welcome to *${restaurantName}*`,
      '',
      cartNotice ? cartNotice : 'Select an option to get started:'
    ];

    // Add configured items as clean UI card buttons
    for (const item of config.homeScreenItems) {
      if (buttons.length >= 6) break; // Keep home options crisp

      if (item === 'browse_menu') {
        buttons.push({
          id: JSON.stringify({ a: 'browse', p: 1 }),
          title: '🍕 Explore Menu',
        });
      } else if (item === 'best_sellers') {
        buttons.push({
          id: JSON.stringify({ a: 'best_sellers' }),
          title: '⭐ Popular Picks',
        });
      } else if (item === 'offers') {
        buttons.push({
          id: JSON.stringify({ a: 'offers' }),
          title: '🔥 Hot Deals',
        });
      } else if (item === 'track_order') {
        buttons.push({
          id: JSON.stringify({ a: 'track_order' }),
          title: '📦 Track Order',
        });
      } else if (item === 'talk_to_staff') {
        buttons.push({
          id: JSON.stringify({ a: 'talk_to_staff' }),
          title: '💬 Need Help',
        });
      }
    }

    return {
      id: 'home',
      title: restaurantName,
      body: bodyLines.join('\n'),
      buttons,
    };
  }
}
