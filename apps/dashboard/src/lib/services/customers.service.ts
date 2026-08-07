import { api } from "../api";
import { Customer, CustomerDetailsResponse } from "../../types";

export class CustomersService {
  /**
   * Retrieves paginated customer list with real DB aggregation.
   */
  static async listCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    segment?: string;
  }): Promise<{ customers: Customer[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));
    if (params?.search) query.append("search", params.search);
    if (params?.segment) query.append("segment", params.segment);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const rawRes = await api.getRaw<any>(`/customers${queryString}`);

    const customersArray = Array.isArray(rawRes?.data) ? rawRes.data : [];
    const mapped = customersArray.map((c: any) => ({
      id: c.id,
      phone: c.phone || "Not Available",
      name: c.name || "WhatsApp Customer",
      address: c.address || null,
      notes: c.notes || null,
      totalOrders: c.totalOrders || 0,
      totalSpend: c.totalSpent || 0,
      lastOrderAt: c.lastOrderDate || c.createdAt,
      createdAt: c.createdAt,
    }));

    const pagination = rawRes?.pagination || {
      total: mapped.length,
      page: params?.page || 1,
      limit: params?.limit || 15,
      totalPages: Math.ceil(mapped.length / (params?.limit || 15)) || 1,
    };

    return {
      customers: mapped,
      pagination,
    };
  }

  /**
   * Retrieves deep CRM metrics and order history for a single customer.
   */
  static async getCustomerDetails(customerId: string): Promise<CustomerDetailsResponse> {
    const rawRes = await api.getRaw<any>(`/customers/${customerId}/details`);
    return rawRes?.data ?? rawRes;
  }

  /**
   * Updates internal restaurant notes for a customer.
   */
  static async updateCustomerNotes(customerId: string, notes: string): Promise<void> {
    await api.patch(`/customers/${customerId}/notes`, { notes });
  }
}

