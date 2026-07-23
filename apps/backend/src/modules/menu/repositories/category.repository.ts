import { db } from '../../../infrastructure/database/database.client';
import { Category } from '../types/menu-item.types';

export class CategoryRepository {
  private get client() {
    return db.getClient();
  }

  public async listByRestaurant(restaurantId: string): Promise<Category[]> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to list categories: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  public async findById(restaurantId: string, id: string): Promise<Category | null> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find category: ${error.message}`);
    }

    return data ? this.mapToDomain(data) : null;
  }

  public async create(
    restaurantId: string,
    input: {
      parentId?: string | null;
      name: string;
      description?: string | null;
      displayOrder?: number;
      icon?: string | null;
      imageUrl?: string | null;
      isVisible?: boolean;
      availableFrom?: string | null;
      availableTill?: string | null;
    },
  ): Promise<Category> {
    const { data, error } = await this.client
      .from('categories')
      .insert({
        restaurant_id: restaurantId,
        parent_id: input.parentId || null,
        name: input.name,
        description: input.description || null,
        display_order: input.displayOrder ?? 0,
        icon: input.icon || null,
        image_url: input.imageUrl || null,
        is_visible: input.isVisible ?? true,
        available_from: input.availableFrom || null,
        available_till: input.availableTill || null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async update(
    restaurantId: string,
    id: string,
    input: {
      parentId?: string | null;
      name?: string;
      description?: string | null;
      displayOrder?: number;
      icon?: string | null;
      imageUrl?: string | null;
      isVisible?: boolean;
      availableFrom?: string | null;
      availableTill?: string | null;
    },
  ): Promise<Category> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.parentId !== undefined) payload['parent_id'] = input.parentId || null;
    if (input.name !== undefined) payload['name'] = input.name;
    if (input.description !== undefined) payload['description'] = input.description || null;
    if (input.displayOrder !== undefined) payload['display_order'] = input.displayOrder;
    if (input.icon !== undefined) payload['icon'] = input.icon || null;
    if (input.imageUrl !== undefined) payload['image_url'] = input.imageUrl || null;
    if (input.isVisible !== undefined) payload['is_visible'] = input.isVisible;
    if (input.availableFrom !== undefined) payload['available_from'] = input.availableFrom || null;
    if (input.availableTill !== undefined) payload['available_till'] = input.availableTill || null;

    const { data, error } = await this.client
      .from('categories')
      .update(payload)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update category: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async delete(restaurantId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  public async updateOrder(restaurantId: string, orders: { id: string; displayOrder: number }[]): Promise<void> {
    // Perform updates in parallel
    await Promise.all(
      orders.map((o) =>
        this.client
          .from('categories')
          .update({ display_order: o.displayOrder, updated_at: new Date().toISOString() })
          .eq('id', o.id)
          .eq('restaurant_id', restaurantId),
      ),
    );
  }

  private mapToDomain(row: any): Category {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      parentId: row.parent_id,
      name: row.name,
      description: row.description,
      displayOrder: row.display_order,
      icon: row.icon,
      imageUrl: row.image_url,
      isVisible: row.is_visible,
      availableFrom: row.available_from,
      availableTill: row.available_till,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
