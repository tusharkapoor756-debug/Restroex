import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';
import { BadRequestError } from '../../../shared/errors/app-error';

export interface ComboItemIncluded {
  menuItemId?: string;
  name: string;
  quantity: number;
}

export interface ComboRecord {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  comboPrice: number;
  originalPrice: number;
  savingsAmount: number;
  imageUrl: string | null;
  itemsIncluded: ComboItemIncluded[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComboDto {
  name: string;
  description?: string;
  comboPrice: number;
  originalPrice?: number;
  imageUrl?: string;
  itemsIncluded: ComboItemIncluded[];
  isActive?: boolean;
}

export class ComboService {
  private get client() {
    return db.getClient();
  }

  public async getCombos(restaurantId: string): Promise<ComboRecord[]> {
    const { data: rows, error } = await this.client
      .from('combos')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error, restaurantId }, '⚠️ [COMBO SERVICE] Failed to fetch combos');
      return [];
    }

    return (rows || []).map(this.mapToDomain);
  }

  public async createCombo(restaurantId: string, dto: CreateComboDto): Promise<ComboRecord> {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestError('Combo name is required');

    const comboPrice = Number(dto.comboPrice);
    if (isNaN(comboPrice) || comboPrice <= 0) {
      throw new BadRequestError('Combo price must be greater than zero');
    }

    const originalPrice = Number(dto.originalPrice || comboPrice);

    const { data: created, error } = await this.client
      .from('combos')
      .insert({
        restaurant_id: restaurantId,
        name,
        description: dto.description || null,
        combo_price: comboPrice,
        original_price: originalPrice,
        image_url: dto.imageUrl || null,
        items_included: Array.isArray(dto.itemsIncluded) ? dto.itemsIncluded : [],
        is_active: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create combo: ${error.message}`);
    }

    return this.mapToDomain(created);
  }

  public async updateCombo(
    restaurantId: string,
    comboId: string,
    updates: Partial<CreateComboDto>
  ): Promise<ComboRecord> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) payload.name = String(updates.name).trim();
    if (updates.description !== undefined) payload.description = updates.description || null;
    if (updates.comboPrice !== undefined) payload.combo_price = Number(updates.comboPrice);
    if (updates.originalPrice !== undefined) payload.original_price = Number(updates.originalPrice);
    if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl || null;
    if (updates.itemsIncluded !== undefined) payload.items_included = updates.itemsIncluded;
    if (updates.isActive !== undefined) payload.is_active = Boolean(updates.isActive);

    const { data: updated, error } = await this.client
      .from('combos')
      .update(payload)
      .eq('id', comboId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update combo: ${error.message}`);
    }

    return this.mapToDomain(updated);
  }

  public async deleteCombo(restaurantId: string, comboId: string): Promise<void> {
    const { error } = await this.client
      .from('combos')
      .delete()
      .eq('id', comboId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete combo: ${error.message}`);
    }
  }

  private mapToDomain(row: any): ComboRecord {
    const comboPrice = Number(row.combo_price || 0);
    const originalPrice = Number(row.original_price || comboPrice);
    const savingsAmount = Math.max(0, originalPrice - comboPrice);

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      description: row.description || null,
      comboPrice,
      originalPrice,
      savingsAmount,
      imageUrl: row.image_url || null,
      itemsIncluded: Array.isArray(row.items_included) ? row.items_included : [],
      isActive: Boolean(row.is_active ?? true),
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const comboService = new ComboService();
