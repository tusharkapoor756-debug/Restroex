import { CustomerRepository } from '../repositories/customer.repository';
import { Customer, CreateCustomerDto, UpdateCustomerDto } from '../types/customer.types';

export class CustomerService {
  private readonly repository = new CustomerRepository();

  public async getOrCreateCustomer(restaurantId: string, phone: string, createdSource: string = 'WEB'): Promise<Customer> {
    const { parseCustomerPhoneIdentity } = require('../../../shared/utils/phone-normalizer');
    const identity = parseCustomerPhoneIdentity(phone);

    // 1. Run 4-Tier Customer Matching Engine
    let existing = await this.repository.findMatchingCustomer(restaurantId, phone);
    if (existing) {
      // If customer exists but was missing primaryPhone or whatsappLid, enrich profile
      const updatePayload: UpdateCustomerDto = {};
      if (!existing.primaryPhone && identity.primaryPhone) {
        updatePayload.primaryPhone = identity.primaryPhone;
      }
      if (!existing.whatsappLid && identity.whatsappLid) {
        updatePayload.whatsappLid = identity.whatsappLid;
      }
      if (Object.keys(updatePayload).length > 0) {
        existing = await this.repository.update(existing.id, updatePayload).catch(() => existing!);
      }
      return existing;
    }

    // 2. Create new customer with 4-Tier identity details
    const newCust = await this.repository.create({
      restaurantId,
      phone,
      contactPhone: identity.primaryPhone || undefined,
      primaryPhone: identity.primaryPhone || undefined,
      whatsappLid: identity.whatsappLid || undefined,
      createdSource,
      name: 'WhatsApp Customer',
    });

    // 3. Register identities in customer_identities table
    if (identity.primaryPhone) {
      await this.repository.registerIdentity(restaurantId, newCust.id, 'phone', identity.primaryPhone);
    }
    if (identity.whatsappLid) {
      await this.repository.registerIdentity(restaurantId, newCust.id, 'whatsapp_lid', identity.whatsappLid);
    }

    return newCust;
  }

  public async updateCustomerProfile(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    return this.repository.update(id, dto);
  }

  public async findByPhone(restaurantId: string, phone: string): Promise<Customer | null> {
    return this.repository.findByPhone(restaurantId, phone);
  }

  public async findById(id: string): Promise<Customer | null> {
    return this.repository.findById(id);
  }
}
export const customerService = new CustomerService();
