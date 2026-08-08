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
      .eq('is_merged', false)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find customer by phone: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async findByPrimaryPhone(restaurantId: string, primaryPhone: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('primary_phone', primaryPhone)
      .eq('is_merged', false)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByWhatsappLid(restaurantId: string, whatsappLid: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('whatsapp_lid', whatsappLid)
      .eq('is_merged', false)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapToDomain(data);
  }

  public async findByIdentityRegistry(restaurantId: string, providerType: string, providerValue: string): Promise<Customer | null> {
    const { data, error } = await this.client
      .from('customer_identities')
      .select('customer:customers(*)')
      .eq('restaurant_id', restaurantId)
      .eq('provider_type', providerType)
      .eq('provider_value', providerValue)
      .maybeSingle();

    if (error || !data || !data.customer) return null;
    if ((data.customer as any).is_merged) return null;
    return this.mapToDomain(data.customer);
  }

  /**
   * 4-Tier Matching Engine
   * Tier 1: primary_phone
   * Tier 2: whatsapp_lid
   * Tier 3: customer_identities table
   * Tier 4: contact_phone / raw phone
   */
  public async findMatchingCustomer(restaurantId: string, inputPhone: string): Promise<Customer | null> {
    const { parseCustomerPhoneIdentity } = require('../../../shared/utils/phone-normalizer');
    const identity = parseCustomerPhoneIdentity(inputPhone);

    // Tier 1: Check primary_phone
    if (identity.primaryPhone) {
      const match1 = await this.findByPrimaryPhone(restaurantId, identity.primaryPhone);
      if (match1) return match1;
    }

    // Tier 2: Check whatsapp_lid
    if (identity.whatsappLid) {
      const match2 = await this.findByWhatsappLid(restaurantId, identity.whatsappLid);
      if (match2) return match2;
    }

    // Tier 3: Check identity registry table
    const providerValue = identity.primaryPhone || identity.whatsappLid || inputPhone;
    const providerType = identity.isLid ? 'whatsapp_lid' : 'phone';
    const match3 = await this.findByIdentityRegistry(restaurantId, providerType, providerValue);
    if (match3) return match3;

    // Tier 4: Check raw phone / contact_phone fallback
    return this.findByPhone(restaurantId, inputPhone);
  }

  public async registerIdentity(restaurantId: string, customerId: string, providerType: string, providerValue: string): Promise<void> {
    try {
      await this.client
        .from('customer_identities')
        .upsert(
          {
            restaurant_id: restaurantId,
            customer_id: customerId,
            provider_type: providerType,
            provider_value: providerValue,
            is_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'restaurant_id,provider_type,provider_value' }
        );
    } catch (err) {
      // Non-fatal: Identity registry error shouldn't break flow
    }
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

  /**
   * Generates the next atomic, per-restaurant customer code (e.g. CUS-000001).
   * Invokes the PL/pgSQL function generate_next_customer_code for 100% lock safety.
   */
  public async generateNextCustomerCode(restaurantId: string): Promise<string> {
    const { data, error } = await this.client.rpc('generate_next_customer_code', {
      p_restaurant_id: restaurantId,
    });

    if (!error && data) {
      return String(data);
    }

    // Fallback: Node.js atomic upsert on restaurant_customer_counters
    const { data: counterRow, error: counterError } = await this.client
      .from('restaurant_customer_counters')
      .select('last_counter')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    const nextVal = (counterRow?.last_counter || 0) + 1;

    await this.client
      .from('restaurant_customer_counters')
      .upsert(
        { restaurant_id: restaurantId, last_counter: nextVal, updated_at: new Date().toISOString() },
        { onConflict: 'restaurant_id' }
      );

    return `CUS-${String(nextVal).padStart(6, '0')}`;
  }

  public async create(dto: CreateCustomerDto): Promise<Customer> {
    const customerCode = dto.customerCode || (await this.generateNextCustomerCode(dto.restaurantId));

    const { data, error } = await this.client
      .from('customers')
      .insert({
        restaurant_id: dto.restaurantId,
        customer_code: customerCode,
        phone: dto.phone,
        contact_phone: dto.contactPhone || null,
        primary_phone: dto.primaryPhone || null,
        whatsapp_lid: dto.whatsappLid || null,
        created_source: dto.createdSource || 'WHATSAPP',
        name: dto.name || 'WhatsApp Customer',
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
    const updatePayload: Record<string, any> = {};
    if (dto.name !== undefined) updatePayload.name = dto.name;
    if (dto.address !== undefined) updatePayload.address = dto.address;
    if (dto.contactPhone !== undefined) updatePayload.contact_phone = dto.contactPhone;
    if (dto.primaryPhone !== undefined) updatePayload.primary_phone = dto.primaryPhone;
    if (dto.whatsappLid !== undefined) updatePayload.whatsapp_lid = dto.whatsappLid;
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from('customers')
      .update(updatePayload)
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
      customerCode: row.customer_code || null,
      phone: row.phone,
      contactPhone: row.contact_phone || null,
      primaryPhone: row.primary_phone || null,
      whatsappLid: row.whatsapp_lid || null,
      createdSource: row.created_source || 'WHATSAPP',
      name: row.name || 'WhatsApp Customer',
      address: row.address,
      notes: row.notes || null,
      firstOrderAt: row.first_order_at || null,
      lastOrderAt: row.last_order_at || null,
      totalOrders: Number(row.total_orders || 0),
      totalSpend: Number(row.total_spend || 0),
      isMerged: Boolean(row.is_merged),
      mergedIntoCustomerId: row.merged_into_customer_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
