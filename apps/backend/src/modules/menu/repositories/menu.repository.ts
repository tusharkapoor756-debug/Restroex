import { db } from '../../../infrastructure/database/database.client';
import { MenuVariant, MenuItemWithVariants, MenuCustomization } from '../types/menu-item.types';
import { VariantInputDto } from '../dto/create-menu-item.dto';

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  vegType: 'veg' | 'non-veg';
  preparationTime: number;
  isPopular: boolean;
  isRecommended: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export class MenuRepository {
  private get client() {
    return db.getClient();
  }

  // ─── Plain list (used by parser for performance) ──────────────────────────

  public async listByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    const { data, error } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list menu items: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  // ─── List with variants & customizations (used by dashboard & AI flow) ─────

  public async listByRestaurantWithVariants(restaurantId: string): Promise<MenuItemWithVariants[]> {
    const { data: itemsData, error: itemsError } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to list menu items: ${itemsError.message}`);
    }

    const items = (itemsData || []) as any[];
    if (items.length === 0) return [];

    const itemIds = items.map((i: any) => i.id);

    // Fetch variants and customizations concurrently
    const [variantsResult, customizationsResult] = await Promise.all([
      this.client
        .from('menu_item_variants')
        .select('*')
        .in('menu_item_id', itemIds)
        .order('display_order', { ascending: true }),
      this.client
        .from('menu_item_customizations')
        .select('*')
        .in('menu_item_id', itemIds)
        .order('name', { ascending: true })
    ]);

    if (variantsResult.error) {
      throw new Error(`Failed to list menu item variants: ${variantsResult.error.message}`);
    }
    if (customizationsResult.error) {
      throw new Error(`Failed to list customizations: ${customizationsResult.error.message}`);
    }

    const variantsByItemId = new Map<string, MenuVariant[]>();
    for (const v of (variantsResult.data || []) as any[]) {
      const mapped = this.mapVariantToDomain(v);
      if (!variantsByItemId.has(mapped.menuItemId)) {
        variantsByItemId.set(mapped.menuItemId, []);
      }
      variantsByItemId.get(mapped.menuItemId)!.push(mapped);
    }

    const customizationsByItemId = new Map<string, MenuCustomization[]>();
    for (const c of (customizationsResult.data || []) as any[]) {
      const mapped = this.mapCustomizationToDomain(c);
      if (!customizationsByItemId.has(mapped.menuItemId)) {
        customizationsByItemId.set(mapped.menuItemId, []);
      }
      customizationsByItemId.get(mapped.menuItemId)!.push(mapped);
    }

    return items.map((row: any) => ({
      ...this.mapToDomain(row),
      variants: variantsByItemId.get(row.id) || [],
      customizations: customizationsByItemId.get(row.id) || [],
    }));
  }

  // ─── Create item (no variants) ────────────────────────────────────────────

  public async create(
    restaurantId: string,
    input: {
      name: string;
      aliases: string[];
      basePrice: number | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      vegType?: 'veg' | 'non-veg';
      preparationTime?: number;
      isPopular?: boolean;
      isRecommended?: boolean;
      displayOrder?: number;
    },
  ): Promise<MenuItem> {
    const { data, error } = await this.client
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name: input.name,
        aliases: input.aliases,
        base_price: input.basePrice,
        is_available: true,
        category_id: input.categoryId || null,
        subcategory_id: input.subcategoryId || null,
        description: input.description || null,
        image_url: input.imageUrl || null,
        veg_type: input.vegType || 'veg',
        preparation_time: input.preparationTime ?? 15,
        is_popular: input.isPopular ?? false,
        is_recommended: input.isRecommended ?? false,
        display_order: input.displayOrder ?? 0,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create menu item: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  // ─── Create item with variants atomically ─────────────────────────────────

  public async createWithVariants(
    restaurantId: string,
    input: {
      name: string;
      aliases: string[];
      basePrice: number | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      vegType?: 'veg' | 'non-veg';
      preparationTime?: number;
      isPopular?: boolean;
      isRecommended?: boolean;
      displayOrder?: number;
      variants: (VariantInputDto & { displayOrder?: number })[];
    },
  ): Promise<MenuItemWithVariants> {
    // 1. Create menu item
    const { data: itemData, error: itemError } = await this.client
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name: input.name,
        aliases: input.aliases,
        base_price: input.basePrice,
        is_available: true,
        category_id: input.categoryId || null,
        subcategory_id: input.subcategoryId || null,
        description: input.description || null,
        image_url: input.imageUrl || null,
        veg_type: input.vegType || 'veg',
        preparation_time: input.preparationTime ?? 15,
        is_popular: input.isPopular ?? false,
        is_recommended: input.isRecommended ?? false,
        display_order: input.displayOrder ?? 0,
      })
      .select('*')
      .single();

    if (itemError) {
      throw new Error(`Failed to create menu item: ${itemError.message}`);
    }

    const menuItem = this.mapToDomain(itemData);

    // 2. Insert variants if provided
    const savedVariants = await this.replaceVariants(menuItem.id, input.variants);

    return { ...menuItem, variants: savedVariants, customizations: [] };
  }

  // ─── Update item (name, price, aliases, dynamic fields) ───────────────────

  public async updateItem(
    restaurantId: string,
    itemId: string,
    input: {
      name?: string;
      aliases?: string[];
      basePrice?: number | null;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      vegType?: 'veg' | 'non-veg';
      preparationTime?: number;
      isPopular?: boolean;
      isRecommended?: boolean;
      displayOrder?: number;
    },
  ): Promise<MenuItem> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload['name'] = input.name;
    if (input.aliases !== undefined) updatePayload['aliases'] = input.aliases;
    if (input.basePrice !== undefined) updatePayload['base_price'] = input.basePrice;
    if (input.categoryId !== undefined) updatePayload['category_id'] = input.categoryId || null;
    if (input.subcategoryId !== undefined) updatePayload['subcategory_id'] = input.subcategoryId || null;
    if (input.description !== undefined) updatePayload['description'] = input.description || null;
    if (input.imageUrl !== undefined) updatePayload['image_url'] = input.imageUrl || null;
    if (input.vegType !== undefined) updatePayload['veg_type'] = input.vegType;
    if (input.preparationTime !== undefined) updatePayload['preparation_time'] = input.preparationTime;
    if (input.isPopular !== undefined) updatePayload['is_popular'] = input.isPopular;
    if (input.isRecommended !== undefined) updatePayload['is_recommended'] = input.isRecommended;
    if (input.displayOrder !== undefined) updatePayload['display_order'] = input.displayOrder;

    const { data, error } = await this.client
      .from('menu_items')
      .update(updatePayload)
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update menu item: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  // ─── Replace variants for a menu item ────────────────────────────────────

  public async replaceVariants(
    menuItemId: string,
    variants: (VariantInputDto & { displayOrder?: number })[],
  ): Promise<MenuVariant[]> {
    // Delete existing variants
    const { error: deleteError } = await this.client
      .from('menu_item_variants')
      .delete()
      .eq('menu_item_id', menuItemId);

    if (deleteError) {
      throw new Error(`Failed to delete old variants: ${deleteError.message}`);
    }

    if (variants.length === 0) return [];

    // Deduplicate by variantName (case-insensitive), last one wins
    const deduped = new Map<string, VariantInputDto & { displayOrder?: number }>();
    for (const v of variants) {
      deduped.set(v.variantName.trim().toLowerCase(), v);
    }

    const rows = Array.from(deduped.values()).map((v, index) => ({
      menu_item_id: menuItemId,
      variant_name: v.variantName.trim(),
      price: v.price,
      is_available: true,
      display_order: v.displayOrder ?? index,
    }));

    const { data, error } = await this.client
      .from('menu_item_variants')
      .insert(rows)
      .select('*');

    if (error) {
      throw new Error(`Failed to insert variants: ${error.message}`);
    }

    return (data || []).map((v: any) => this.mapVariantToDomain(v));
  }

  // ─── Reorder items list ───────────────────────────────────────────────────

  public async updateItemsOrder(restaurantId: string, orders: { id: string; displayOrder: number }[]): Promise<void> {
    await Promise.all(
      orders.map((o) =>
        this.client
          .from('menu_items')
          .update({ display_order: o.displayOrder, updated_at: new Date().toISOString() })
          .eq('id', o.id)
          .eq('restaurant_id', restaurantId),
      ),
    );
  }

  // ─── Availability ─────────────────────────────────────────────────────────

  public async setAvailability(restaurantId: string, itemId: string, isAvailable: boolean): Promise<MenuItem> {
    const { data, error } = await this.client
      .from('menu_items')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update menu item: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async delete(restaurantId: string, itemId: string): Promise<void> {
    const { error } = await this.client
      .from('menu_items')
      .delete()
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete menu item: ${error.message}`);
    }
  }

  // ─── Find by ID ───────────────────────────────────────────────────────────

  public async findById(restaurantId: string, menuItemId: string): Promise<MenuItem | null> {
    const { data, error } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('id', menuItemId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find menu item: ${error.message}`);
    }

    return data ? this.mapToDomain(data) : null;
  }

  // ─── Variant helpers (used by parser/bot) ─────────────────────────────────

  public async hasVariants(menuItemId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from('menu_item_variants')
      .select('*', { count: 'exact', head: true })
      .eq('menu_item_id', menuItemId)
      .eq('is_available', true);

    if (error) {
      throw new Error(`Failed to check variants: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  public async findVariants(menuItemId: string): Promise<MenuVariant[]> {
    const { data, error } = await this.client
      .from('menu_item_variants')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .eq('is_available', true)
      .order('display_order', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch variants: ${error.message}`);
    }

    return (data ?? []).map((v: any) => this.mapVariantToDomain(v));
  }

  // ─── Domain mappers ───────────────────────────────────────────────────────

  private mapToDomain(row: any): MenuItem {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      aliases: row.aliases || [],
      basePrice: row.base_price !== null && row.base_price !== undefined ? Number(row.base_price) : null,
      isAvailable: row.is_available,
      categoryId: row.category_id,
      subcategoryId: row.subcategory_id,
      description: row.description,
      imageUrl: row.image_url,
      vegType: row.veg_type || 'veg',
      preparationTime: row.preparation_time ?? 15,
      isPopular: row.is_popular || false,
      isRecommended: row.is_recommended || false,
      displayOrder: row.display_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapVariantToDomain(row: any): MenuVariant {
    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      variantName: row.variant_name,
      price: Number(row.price),
      isAvailable: row.is_available,
      displayOrder: row.display_order ?? 0,
    };
  }

  private mapCustomizationToDomain(row: any): MenuCustomization {
    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      name: row.name,
      priceAdjustment: Number(row.price_adjustment),
      isAvailable: row.is_available,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
