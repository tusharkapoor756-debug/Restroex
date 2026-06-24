import { db } from '../../../infrastructure/database/database.client';

export interface Restaurant {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSetupUpdate {
  name?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export class RestaurantRepository {
  private get client() {
    return db.getClient();
  }

  public async findById(id: string): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find restaurant by ID: ${error.message}`);
    }

    return data ? this.mapToDomain(data) : null;
  }

  public async findByPhoneNumber(phoneNumber: string): Promise<Restaurant | null> {
    return this.findByPhoneColumn(phoneNumber, 'phone_number');
  }

  public async upsertByPhoneNumber(name: string, phoneNumber: string): Promise<Restaurant> {
    const existing = await this.findByPhoneNumber(phoneNumber);
    if (existing) return existing;

    const { data, error } = await this.client
      .from('restaurants')
      .insert({
        name,
        phone_number: phoneNumber,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create restaurant session tenant: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async updateSetup(restaurantId: string, update: RestaurantSetupUpdate): Promise<Restaurant> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (update.name !== undefined) payload.name = update.name;
    if (update.phoneNumber !== undefined) payload.phone_number = update.phoneNumber;
    if (update.email !== undefined) payload.email = update.email;
    if (update.address !== undefined) payload.address = update.address;
    if (update.city !== undefined) payload.city = update.city;
    if (update.state !== undefined) payload.state = update.state;
    if (update.pincode !== undefined) payload.pincode = update.pincode;

    const { data, error } = await this.client
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId)
      .select('*')
      .single();

    if (error && this.isMissingPhoneNumberColumnError(error.message) && update.phoneNumber !== undefined) {
      const fallbackPayload: Record<string, unknown> = { ...payload, phone: update.phoneNumber };
      delete fallbackPayload.phone_number;
      const fallback = await this.client
        .from('restaurants')
        .update(fallbackPayload)
        .eq('id', restaurantId)
        .select('*')
        .single();

      if (fallback.error) {
        throw new Error(`Failed to update restaurant setup: ${fallback.error.message}`);
      }

      return this.mapToDomain(fallback.data);
    }

    if (error) {
      throw new Error(`Failed to update restaurant setup: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  private async findByPhoneColumn(phoneNumber: string, column: 'phone_number' | 'phone'): Promise<Restaurant | null> {
    const { data, error } = await this.client
      .from('restaurants')
      .select('*')
      .eq(column, phoneNumber)
      .maybeSingle();

    if (error && column === 'phone_number' && this.isMissingPhoneNumberColumnError(error.message)) {
      return this.findByPhoneColumn(phoneNumber, 'phone');
    }

    if (error) {
      throw new Error(`Failed to find restaurant by phone number: ${error.message}`);
    }

    return data ? this.mapToDomain(data) : null;
  }

  private isMissingPhoneNumberColumnError(message: string): boolean {
    return /phone_number/i.test(message) && /column|schema cache|does not exist/i.test(message);
  }

  private mapToDomain(row: any): Restaurant {
    return {
      id: row.id,
      name: row.name,
      phoneNumber: row.phone_number || row.phone || '',
      email: row.email || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || '',
      pincode: row.pincode || '',
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
