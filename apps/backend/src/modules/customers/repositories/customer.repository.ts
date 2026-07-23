import { db } from '../../../infrastructure/database/database.client';
import { Customer, CreateCustomerDto, UpdateCustomerDto } from '../types/customer.types';

export class CustomerRepository {
  private get client() {
    return db.getClient();
  }

  public async findByPhone(restaurantId: string, phone: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('phone', phone)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by phone: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async findById(id: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by id: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async create(dto: CreateCustomerDto): Promise<Customer> {
    const { data, error } = await this.client
      .from('customers')
      .insert({
        restaurant_id: dto.restaurantId,
        phone: dto.phone,
        name: dto.name || null,
        address: dto.address || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        const existing = await this.findByPhone(dto.restaurantId, dto.phone);
        if (existing) return existing;
      }
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const { data, error } = await this.client
      .from('customers')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  private mapToDomain(row: any): Customer {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      phone: row.phone,
      name: row.name,
      address: row.address,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
