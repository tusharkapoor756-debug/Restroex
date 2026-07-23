import { InteractiveScreen } from '../interactive-action.types';
import { db } from '../../../../infrastructure/database/database.client';

export class InteractiveRecommendationHandler {
  private get client() {
    return db.getClient();
  }

  public async renderBestSellers(restaurantId: string): Promise<InteractiveScreen> {
    const { data: items, error } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .or('is_popular.eq.true,is_recommended.eq.true')
      .limit(8);

    if (error) {
      throw new Error(`Failed to load best sellers: ${error.message}`);
    }

    const body = items.length === 0 
      ? 'No special recommendations at the moment. Browse the menu to see all dishes!' 
      : '🔥 *Best Sellers & Recommendations:*\nHere are our top rated dishes:';

    const rows = items.map((item: any) => {
      const priceText = item.base_price !== null ? ` - ₹${item.base_price}` : '';
      return {
        id: JSON.stringify({ a: 'item', id: item.id }),
        title: `${item.veg_type === 'veg' ? '🟢' : '🔴'} ${item.name}`,
        description: `${item.description || ''}${priceText}`.trim(),
      };
    });

    return {
      id: 'best_sellers',
      title: '🔥 Best Sellers',
      body,
      list: rows.length > 0 ? {
        buttonTitle: 'Choose Item',
        sections: [{ title: 'Best Sellers', rows }],
      } : undefined,
      buttons: [
        { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Browse Menu' },
      ],
      previousScreenId: 'home',
    };
  }
}
