import { InteractiveScreen } from '../interactive-action.types';
import { db } from '../../../../infrastructure/database/database.client';

export class InteractiveOfferHandler {
  private get client() {
    return db.getClient();
  }

  public async renderOffers(restaurantId: string): Promise<InteractiveScreen> {
    // Dynamically retrieve offers from database (or return default/mock dynamic promotions if no campaign table exists)
    // Future-proof structure allowing database campaign extension without changes to screen engine
    const { data: campaignItems } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .eq('is_recommended', true)
      .limit(3);

    let body = '🎁 *Today\'s Special Deals & Offers:*\n\n';
    
    if (campaignItems && campaignItems.length > 0) {
      body += '🔥 *Special Discount on Chef Pick Items:*\n';
      campaignItems.forEach((item: any) => {
        const discountedPrice = item.base_price ? Math.round(item.base_price * 0.9) : null;
        body += `- *${item.name}*: Flat 10% Off! Now at ~₹${item.base_price}~ *₹${discountedPrice}*\n`;
      });
    } else {
      body += '• Get free delivery on orders above ₹500!\n• Use code *FIRSTRESTRO* to get a free drink on your first order.';
    }

    const rows = (campaignItems || []).map((item: any) => ({
      id: JSON.stringify({ a: 'item', id: item.id }),
      title: `Claim 10% Off: ${item.name}`,
      description: `Add directly to your order`,
    }));

    return {
      id: 'offers',
      title: '🎁 Special Offers',
      body,
      list: rows.length > 0 ? {
        buttonTitle: 'Claim Offers',
        sections: [{ title: 'Deals of the Day', rows }],
      } : undefined,
      buttons: [
        { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Browse Menu' },
      ],
      previousScreenId: 'home',
    };
  }
}
