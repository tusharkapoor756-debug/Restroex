import { InteractiveScreen } from '../interactive-action.types';
import { db } from '../../../../infrastructure/database/database.client';

export class InteractiveSearchHandler {
  private get client() {
    return db.getClient();
  }

  public async search(restaurantId: string, query: string): Promise<InteractiveScreen> {
    const { data: items, error } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(6);

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    const body = items.length === 0 
      ? `Sorry, no items matched your search for "${query}".`
      : `Here are the search results matching "${query}":`;

    const rows = items.map((item: any) => {
      const priceText = item.base_price !== null ? ` - ₹${item.base_price}` : '';
      return {
        id: JSON.stringify({ a: 'item', id: item.id }),
        title: `${item.veg_type === 'veg' ? '🟢' : '🔴'} ${item.name}`,
        description: `${item.description || ''}${priceText}`.trim(),
      };
    });

    return {
      id: `search_${query}`,
      title: 'Search Results',
      body,
      list: rows.length > 0 ? {
        buttonTitle: 'Select Match',
        sections: [{ title: 'Results', rows }],
      } : undefined,
      buttons: [
        { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Browse Categories' },
      ],
      previousScreenId: 'home',
    };
  }
}
