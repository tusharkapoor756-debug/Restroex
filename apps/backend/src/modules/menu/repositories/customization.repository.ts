import { db } from '../../../infrastructure/database/database.client';
import { MenuCustomization } from '../types/menu-item.types';

export class CustomizationRepository {
  private get client() {
    return db.getClient();
  }

  public async listByMenuItem(menuItemId: string): Promise<MenuCustomization[]> {
    const { data, error } = await this.client
      .from('menu_item_customizations')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to list customizations: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  public async findById(id: string): Promise<MenuCustomization | null> {
    const { data, error } = await this.client
      .from('menu_item_customizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customization: ${error.message}`);
    }

    return data ? this.mapToDomain(data) : null;
  }

  public async create(
    menuItemId: string,
    input: {
      name: string;
      priceAdjustment: number;
      isAvailable?: boolean;
    },
  ): Promise<MenuCustomization> {
    const { data, error } = await this.client
      .from('menu_item_customizations')
      .insert({
        menu_item_id: menuItemId,
        name: input.name,
        price_adjustment: input.priceAdjustment,
        is_available: input.isAvailable ?? true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create customization: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async update(
    id: string,
    input: {
      name?: string;
      priceAdjustment?: number;
      isAvailable?: boolean;
    },
  ): Promise<MenuCustomization> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) payload['name'] = input.name;
    if (input.priceAdjustment !== undefined) payload['price_adjustment'] = input.priceAdjustment;
    if (input.isAvailable !== undefined) payload['is_available'] = input.isAvailable;

    const { data, error } = await this.client
      .from('menu_item_customizations')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update customization: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from('menu_item_customizations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete customization: ${error.message}`);
    }
  }

  private mapToDomain(row: any): MenuCustomization {
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
export const customizationRepository = new CustomizationRepository();
