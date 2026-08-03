import { db } from '../../../infrastructure/database/database.client';
import { RestaurantCharge } from '../types/billing.types';

export class ChargeRepository {
  private client = db.getClient();

  /**
   * Maps database row to domain interface
   */
  private mapToDomain(row: any): RestaurantCharge {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      type: row.type,
      calculationType: row.calculation_type,
      value: Number(row.value),
      pricingType: row.pricing_type,
      scope: row.scope || 'order',
      applyOn: Array.isArray(row.apply_on) ? row.apply_on : ['dining', 'takeaway', 'delivery'],
      showOnInvoice: Boolean(row.show_on_invoice),
      enabled: Boolean(row.enabled),
      isSystem: Boolean(row.is_system),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Fetch all charges configured for a restaurant
   */
  public async getCharges(restaurantId: string): Promise<RestaurantCharge[]> {
    const { data, error } = await this.client
      .from('restaurant_charges')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      // If table doesn't exist yet in local env, gracefully return defaults
      if (error.code === '42P01') {
        return this.getDefaultFallbackCharges(restaurantId);
      }
      throw new Error(`Failed to fetch restaurant charges: ${error.message}`);
    }

    if (!data || data.length === 0) {
      // Auto-seed system defaults if none exist
      return this.seedSystemCharges(restaurantId);
    }

    return data.map((row: any) => this.mapToDomain(row));
  }

  /**
   * Create a new custom or system charge
   */
  public async createCharge(
    restaurantId: string,
    chargeData: Omit<RestaurantCharge, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>
  ): Promise<RestaurantCharge> {
    const { data, error } = await this.client
      .from('restaurant_charges')
      .insert({
        restaurant_id: restaurantId,
        name: chargeData.name,
        type: chargeData.type,
        calculation_type: chargeData.calculationType,
        value: chargeData.value,
        pricing_type: chargeData.pricingType,
        scope: chargeData.scope || 'order',
        apply_on: chargeData.applyOn,
        show_on_invoice: chargeData.showOnInvoice,
        enabled: chargeData.enabled,
        is_system: chargeData.isSystem || false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create charge: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Update an existing charge
   */
  public async updateCharge(
    restaurantId: string,
    chargeId: string,
    updates: Partial<Omit<RestaurantCharge, 'id' | 'restaurantId' | 'isSystem'>>
  ): Promise<RestaurantCharge> {
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.type !== undefined) updatePayload.type = updates.type;
    if (updates.calculationType !== undefined) updatePayload.calculation_type = updates.calculationType;
    if (updates.value !== undefined) updatePayload.value = updates.value;
    if (updates.pricingType !== undefined) updatePayload.pricing_type = updates.pricingType;
    if (updates.scope !== undefined) updatePayload.scope = updates.scope;
    if (updates.applyOn !== undefined) updatePayload.apply_on = updates.applyOn;
    if (updates.showOnInvoice !== undefined) updatePayload.show_on_invoice = updates.showOnInvoice;
    if (updates.enabled !== undefined) updatePayload.enabled = updates.enabled;

    const { data, error } = await this.client
      .from('restaurant_charges')
      .update(updatePayload)
      .eq('id', chargeId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update charge ${chargeId}: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Delete a custom charge (Guarded: Protected system charges cannot be deleted)
   */
  public async deleteCharge(restaurantId: string, chargeId: string): Promise<boolean> {
    const { data: existing } = await this.client
      .from('restaurant_charges')
      .select('is_system')
      .eq('id', chargeId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (existing?.is_system) {
      throw new Error('Protected system charges (GST, Packaging, Service, Delivery) cannot be deleted.');
    }

    const { error } = await this.client
      .from('restaurant_charges')
      .delete()
      .eq('id', chargeId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete charge ${chargeId}: ${error.message}`);
    }

    return true;
  }

  /**
   * Seed default system protected charges for a restaurant
   */
  private async seedSystemCharges(restaurantId: string): Promise<RestaurantCharge[]> {
    const defaults = this.getDefaultFallbackCharges(restaurantId);
    const results: RestaurantCharge[] = [];

    for (const d of defaults) {
      try {
        const created = await this.createCharge(restaurantId, d);
        results.push(created);
      } catch (err) {
        results.push({ ...d, id: `sys_${d.name.toLowerCase().replace(/\s+/g, '_')}` });
      }
    }

    return results;
  }

  /**
   * Safe fallback in-memory defaults if DB table is unmigrated
   */
  private getDefaultFallbackCharges(restaurantId: string): RestaurantCharge[] {
    return [
      {
        id: 'sys_gst',
        restaurantId,
        name: 'GST',
        type: 'tax',
        calculationType: 'percentage',
        value: 5.0,
        pricingType: 'exclusive',
        scope: 'order',
        applyOn: ['dining', 'takeaway', 'delivery'],
        showOnInvoice: true,
        enabled: true,
        isSystem: true,
      },
      {
        id: 'sys_packaging',
        restaurantId,
        name: 'Packaging Charge',
        type: 'fee',
        calculationType: 'fixed',
        value: 0.0,
        pricingType: 'exclusive',
        scope: 'order',
        applyOn: ['takeaway', 'delivery'],
        showOnInvoice: true,
        enabled: false,
        isSystem: true,
      },
      {
        id: 'sys_service',
        restaurantId,
        name: 'Service Charge',
        type: 'fee',
        calculationType: 'percentage',
        value: 0.0,
        pricingType: 'exclusive',
        scope: 'order',
        applyOn: ['dining'],
        showOnInvoice: true,
        enabled: false,
        isSystem: true,
      },
      {
        id: 'sys_delivery',
        restaurantId,
        name: 'Delivery Charge',
        type: 'fee',
        calculationType: 'fixed',
        value: 0.0,
        pricingType: 'exclusive',
        scope: 'order',
        applyOn: ['delivery'],
        showOnInvoice: true,
        enabled: false,
        isSystem: true,
      },
    ];
  }
}
