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

    // Fetch category name and icon
    const { data: category } = await this.client
      .from('categories')
      .select('name, icon')
      .eq('id', categoryId)
      .single();

    // Fetch menu items in category
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
    const categoryIcon = category?.icon || '🥘';
    const body = items.length === 0 
      ? `No items found in *${categoryName}*.` 
      : `✨ *Choose an Option*`;

    // Map item options with Title & Price on single line
    const buttons: Array<{ id: string; title: string }> = items.map((item: any) => {
      const priceVal = item.base_price !== null ? item.base_price : 0;
      // Capitalize first letters for clean display
      const formattedName = item.name.replace(/\b\w/g, (c: string) => c.toUpperCase());
      return {
        id: JSON.stringify({ a: 'item', id: item.id }),
        title: `${formattedName} • ₹${priceVal}`,
      };
    });

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
      title: `${categoryIcon} *${categoryName}*`,
      body,
      buttons,
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
    const formattedItemName = item.name.replace(/\b\w/g, (c: string) => c.toUpperCase());

    if (hasVariants) {
      let bodyLines: string[] = [vegBadge];
      if (item.preparation_time) {
        bodyLines.push(`⏱️ ${item.preparation_time} mins`);
      } else {
        bodyLines.push(`⏱️ 15 mins`);
      }

      const body = `${bodyLines.join('\n\n')}\n\n✨ *Choose an Option*`;

      const buttons: Array<{ id: string; title: string }> = [];
      item.menu_item_variants.forEach((v: any) => {
        const formattedVariant = v.variant_name.replace(/\b\w/g, (c: string) => c.toUpperCase());
        buttons.push({
          id: JSON.stringify({ a: 'variant', id: item.id, vid: v.id }),
          title: `${formattedVariant} • ₹${v.price}`,
        });
      });

      return {
        id: `item_${itemId}`,
        title: formattedItemName,
        body,
        buttons,
        previousScreenId: JSON.stringify({ a: 'category', id: item.category_id, p: 1 }),
      };
    } else {
      // Direct Quantity Input Screen for items without variants
      const body = `₹${item.base_price}\n\n📦 *Quantity*\n\nEnter the quantity.\n\nExamples:\n• 1\n• 2\n• 5`;
      return {
        id: `quantity_prompt_${itemId}`,
        title: formattedItemName,
        body,
        inputPrompt: true,
        buttons: [
          {
            id: JSON.stringify({ a: 'quantity', id: item.id }),
            title: 'context_holder',
          },
        ],
        previousScreenId: JSON.stringify({ a: 'category', id: item.category_id, p: 1 }),
        metadata: {
          pendingQuantityItem: {
            id: item.id,
            name: item.name,
            price: item.base_price,
          },
        },
      };
    }
  }

  public async renderVariantDetail(restaurantId: string, itemId: string, variantId: string): Promise<InteractiveScreen> {
    const { data: item } = await this.client.from('menu_items').select('*').eq('id', itemId).single();
    const { data: variant } = await this.client.from('menu_item_variants').select('*').eq('id', variantId).single();
    
    if (!item || !variant) {
      throw new Error('Item or variant not found');
    }

    const formattedItemName = item.name.replace(/\b\w/g, (c: string) => c.toUpperCase());
    const formattedVariantName = variant.variant_name.replace(/\b\w/g, (c: string) => c.toUpperCase());

    const body = `${formattedVariantName} • ₹${variant.price}\n\n📦 *Quantity*\n\nEnter the quantity.\n\nExamples:\n• 1\n• 2\n• 5`;

    return {
      id: `quantity_prompt_${variantId}`,
      title: formattedItemName,
      body,
      inputPrompt: true,
      buttons: [
        {
          id: JSON.stringify({ a: 'quantity', id: itemId, vid: variantId }),
          title: 'context_holder',
        },
      ],
      previousScreenId: JSON.stringify({ a: 'item', id: itemId }),
      metadata: {
        pendingQuantityItem: {
          id: itemId,
          vid: variantId,
          name: item.name,
          variantName: variant.variant_name,
          price: variant.price,
        },
      },
    };
  }
}
