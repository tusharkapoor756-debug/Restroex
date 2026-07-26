import { api } from "../api";
import { Customer } from "../../types";

export class CustomersService {
  /**
   * Retrieves customer list with real DB aggregation.
   */
  static async listCustomers(search?: string): Promise<Customer[]> {
    const res = await api.get<any>(search ? `/customers?search=${encodeURIComponent(search)}` : "/customers");
    const list = Array.isArray(res) ? res : (res?.data || []);
    return list.map((c: any) => ({
      id: c.id,
      phone: c.phone,
      name: c.name || "WhatsApp Customer",
      totalOrders: c.totalOrders || 0,
      totalSpend: c.totalSpent || 0,
      lastOrderAt: c.lastOrderDate || c.createdAt,
    }));
  }
}
