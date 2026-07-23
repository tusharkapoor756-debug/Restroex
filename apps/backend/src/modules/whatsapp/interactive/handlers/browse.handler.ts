import { InteractiveScreen } from '../interactive-action.types';
import { db } from '../../../../infrastructure/database/database.client';

export class InteractiveBrowseHandler {
  private get client() {
    return db.getClient();
  }

  public async renderCategories(restaurantId: string, page = 1): Promise<InteractiveScreen> {
    const limit = 8;
    const offset = (page - 1) * limit;

    // Fetch parent categories
    const { data: categories, error } = await this.client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .is('parent_id', null)
      .eq('is_visible', true)
      .order('display_order', { ascending: true })
      .range(offset, offset + limit);

    if (error) {
      throw new Error(`Failed to load categories: ${error.message}`);
    }

    const { count } = await this.client
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .is('parent_id', null)
      .eq('is_visible', true);

    const hasMore = (count || 0) > page * limit;
    const body = categories.length === 0 
      ? 'No categories available at the moment.' 
      : 'Select a category to browse delicious food items:';

    const rows = categories.map((cat: any) => ({
      id: JSON.stringify({ a: 'category', id: cat.id, p: 1 }),
      title: `${cat.icon || '🍽️'} ${cat.name}`,
      description: cat.description || undefined,
    }));

    const buttons: Array<{ id: string; title: string }> = [];
    if (page > 1) {
      buttons.push({
        id: JSON.stringify({ a: 'browse', p: page - 1 }),
        title: '⬅️ Previous Page',
      });
    }
    if (hasMore) {
      buttons.push({
        id: JSON.stringify({ a: 'browse', p: page + 1 }),
        title: 'More Categories ➡️',
      });
    }

    return {
      id: `browse_${page}`,
      title: 'Browse Menu',
      body,
      buttons,
      list: rows.length > 0 ? {
        buttonTitle: 'Choose Category',
        sections: [{ title: 'Categories', rows }],
      } : undefined,
      previousScreenId: 'home',
    };
  }

  public async renderCategoryItems(restaurantId: string, categoryId: string, page = 1): Promise<InteractiveScreen> {
    const limit = 8;
    const offset = (page - 1) * limit;

    // Fetch category name
    const { data: category } = await this.client
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .single();

    // Fetch menu items in category or subcategories
    const { data: items, error } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('display_order', { ascending: true })
      .range(offset, offset + limit);

    if (error) {
      throw new Error(`Failed to load items in category: ${error.message}`);
    }

    const { count } = await this.client
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId)
      .eq('is_available', true);

    const hasMore = (count || 0) > page * limit;
    const categoryName = category?.name || 'Items';
    const body = items.length === 0 
      ? `No items found in *${categoryName}*.` 
      : `Browse items under *${categoryName}*:`;

    const rows = items.map((item: any) => {
      const priceText = item.base_price !== null ? ` - ₹${item.base_price}` : '';
      return {
        id: JSON.stringify({ a: 'item', id: item.id }),
        title: `${item.veg_type === 'veg' ? '🟢' : '🔴'} ${item.name}`,
        description: `${item.description || ''}${priceText}`.trim(),
      };
    });

    const buttons: Array<{ id: string; title: string }> = [];
    if (page > 1) {
      buttons.push({
        id: JSON.stringify({ a: 'category', id: categoryId, p: page - 1 }),
        title: '⬅️ Previous Page',
      });
    }
    if (hasMore) {
      buttons.push({
        id: JSON.stringify({ a: 'category', id: categoryId, p: page + 1 }),
        title: 'More Items ➡️',
      });
    }

    return {
      id: `category_${categoryId}_${page}`,
      title: categoryName,
      body,
      buttons,
      list: rows.length > 0 ? {
        buttonTitle: 'Choose Item',
        sections: [{ title: 'Dishes', rows }],
      } : undefined,
      previousScreenId: JSON.stringify({ a: 'browse', p: 1 }),
    };
  }

  public async renderItemDetail(restaurantId: string, itemId: string): Promise<InteractiveScreen> {
    // Fetch item with variants and customizations
    const { data: item, error } = await this.client
      .from('menu_items')
      .select('*, menu_item_variants(*), menu_item_customizations(*)')
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !item) {
      throw new Error('Menu item not found');
    }

    const hasVariants = item.menu_item_variants && item.menu_item_variants.length > 0;
    const vegBadge = item.veg_type === 'veg' ? '🟢 Veg' : '🔴 Non-Veg';
    
    let body = `*${item.name}* (${vegBadge})\n`;
    if (item.description) {
      body += `_${item.description}_\n`;
    }
    if (item.preparation_time) {
      body += `⏱️ Prep Time: ${item.preparation_time} mins\n`;
    }
    body += '\n';

    const buttons: Array<{ id: string; title: string }> = [];

    if (hasVariants) {
      body += `*Select a size / option below:*\n`;
      item.menu_item_variants.forEach((v: any) => {
        body += `- *${v.variant_name}*: ₹${v.price}\n`;
      });

      // Show top 3 variants as buttons
      item.menu_item_variants.slice(0, 3).forEach((v: any) => {
        buttons.push({
          id: JSON.stringify({ a: 'variant', id: item.id, vid: v.id }),
          title: `${v.variant_name} (₹${v.price})`,
        });
      });
    } else {
      body += `Price: *₹${item.base_price}*\n`;
      
      // Directly choose quantity
      buttons.push({
        id: JSON.stringify({ a: 'quantity', id: item.id, q: 1 }),
        title: 'Add 1 to Cart',
      });
      buttons.push({
        id: JSON.stringify({ a: 'quantity', id: item.id, q: 2 }),
        title: 'Add 2 to Cart',
      });
    }

    return {
      id: `item_${itemId}`,
      title: item.name,
      body,
      buttons,
      previousScreenId: JSON.stringify({ a: 'category', id: item.category_id, p: 1 }),
    };
  }

  public async renderVariantDetail(restaurantId: string, itemId: string, variantId: string): Promise<InteractiveScreen> {
    const { data: item } = await this.client.from('menu_items').select('*').eq('id', itemId).single();
    const { data: variant } = await this.client.from('menu_item_variants').select('*').eq('id', variantId).single();
    
    if (!item || !variant) {
      throw new Error('Item or variant not found');
    }

    const title = `${item.name} (${variant.variant_name})`;
    const body = `*${title}*\nPrice: *₹${variant.price}*\n\nSelect quantity below to add to your order:`;

    const buttons = [
      { id: JSON.stringify({ a: 'quantity', id: itemId, vid: variantId, q: 1 }), title: 'Add 1 to Cart' },
      { id: JSON.stringify({ a: 'quantity', id: itemId, vid: variantId, q: 2 }), title: 'Add 2 to Cart' },
      { id: JSON.stringify({ a: 'quantity', id: itemId, vid: variantId, q: 3 }), title: 'Add 3 to Cart' },
    ];

    return {
      id: `variant_${variantId}`,
      title,
      body,
      buttons,
      previousScreenId: JSON.stringify({ a: 'item', id: itemId }),
    };
  }
}
