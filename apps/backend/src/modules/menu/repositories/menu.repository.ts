import { db } from '../../../infrastructure/database/database.client';

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  aliases: string[];
  basePrice: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export class MenuRepository {
  private get client() {
    return db.getClient();
  }

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

  public async create(restaurantId: string, input: { name: string; aliases: string[]; basePrice: number }): Promise<MenuItem> {
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

  private mapToDomain(row: any): MenuItem {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      aliases: row.aliases || [],
      basePrice: Number(row.base_price),
      isAvailable: row.is_available,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
