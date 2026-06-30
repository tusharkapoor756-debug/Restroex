import { db } from '../../../infrastructure/database/database.client';
import { MenuVariant, MenuItemWithVariants } from '../types/menu-item.types';
import { VariantInputDto } from '../dto/create-menu-item.dto';

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
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
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list menu items: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  // ─── List with variants (used by dashboard & AI flow) ────────────────────

  public async listByRestaurantWithVariants(restaurantId: string): Promise<MenuItemWithVariants[]> {
    const { data: itemsData, error: itemsError } = await this.client
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to list menu items: ${itemsError.message}`);
    }

    const items = (itemsData || []) as any[];
    if (items.length === 0) return [];

    const itemIds = items.map((i: any) => i.id);

    const { data: variantsData, error: variantsError } = await this.client
      .from('menu_item_variants')
      .select('*')
      .in('menu_item_id', itemIds)
      .order('price', { ascending: true });

    if (variantsError) {
      throw new Error(`Failed to list menu item variants: ${variantsError.message}`);
    }

    const variantsByItemId = new Map<string, MenuVariant[]>();
    for (const v of (variantsData || []) as any[]) {
      const mapped = this.mapVariantToDomain(v);
      if (!variantsByItemId.has(mapped.menuItemId)) {
        variantsByItemId.set(mapped.menuItemId, []);
      }
      variantsByItemId.get(mapped.menuItemId)!.push(mapped);
    }

    return items.map((row: any) => ({
      ...this.mapToDomain(row),
      variants: variantsByItemId.get(row.id) || [],
    }));
  }

  // ─── Create item (no variants) ────────────────────────────────────────────

  public async create(
    restaurantId: string,
    input: { name: string; aliases: string[]; basePrice: number | null },
  ): Promise<MenuItem> {
    const { data, error } = await this.client
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name: input.name,
        aliases: input.aliases,
        base_price: input.basePrice,
        is_available: true,
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
    input: { name: string; aliases: string[]; basePrice: number | null; variants: VariantInputDto[] },
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
      })
      .select('*')
      .single();

    if (itemError) {
      throw new Error(`Failed to create menu item: ${itemError.message}`);
    }

    const menuItem = this.mapToDomain(itemData);

    // 2. Insert variants if provided (dedup by variantName)
    const savedVariants = await this.replaceVariants(menuItem.id, input.variants);

    return { ...menuItem, variants: savedVariants };
  }

  // ─── Update item (name, price, aliases) ──────────────────────────────────

  public async updateItem(
    restaurantId: string,
    itemId: string,
    input: { name?: string; aliases?: string[]; basePrice?: number | null },
  ): Promise<MenuItem> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload['name'] = input.name;
    if (input.aliases !== undefined) updatePayload['aliases'] = input.aliases;
    if (input.basePrice !== undefined) updatePayload['base_price'] = input.basePrice;

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

  public async replaceVariants(menuItemId: string, variants: VariantInputDto[]): Promise<MenuVariant[]> {
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
    const deduped = new Map<string, VariantInputDto>();
    for (const v of variants) {
      deduped.set(v.variantName.trim().toLowerCase(), v);
    }

    const rows = Array.from(deduped.values()).map((v) => ({
      menu_item_id: menuItemId,
      variant_name: v.variantName.trim(),
      price: v.price,
      is_available: true,
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
      .order('price');

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
    };
  }
}
