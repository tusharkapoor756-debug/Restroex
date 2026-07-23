import { CustomerRepository } from '../repositories/customer.repository';
import { Customer, CreateCustomerDto, UpdateCustomerDto } from '../types/customer.types';

export class CustomerService {
  private readonly repository = new CustomerRepository();

  public async getOrCreateCustomer(restaurantId: string, phone: string): Promise<Customer> {
    const existing = await this.repository.findByPhone(restaurantId, phone);
    if (existing) return existing;

    return this.repository.create({
      restaurantId,
      phone,
    });
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
