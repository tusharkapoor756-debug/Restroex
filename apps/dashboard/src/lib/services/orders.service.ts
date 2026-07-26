import { api } from "../api";
import { Order, WorkflowOrderStatus } from "../../types";

export class OrdersService {
  /**
   * Retrieves all currently active orders for the restaurant.
   */
  static async getActiveOrders(): Promise<Order[]> {
    return api.get<Order[]>("/orders/active");
  }

  /**
   * Transitions the status of a specific order.
   */
  static async transitionOrder(orderId: string, status: WorkflowOrderStatus): Promise<Order> {
    return api.patch<Order>(`/orders/${orderId}/status`, { status });
  }

  /**
   * Retrieves paginated order history with search and status filters.
   */
  static async getOrderHistory(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ orders: Order[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));
    if (params?.search) query.append("search", params.search);
    if (params?.status) query.append("status", params.status);
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await api.get<any>(`/orders/history${queryString}`);
    // api.get<any> unwraps json.data directly
    const ordersArray = Array.isArray(res) ? res : (res?.data || []);
    return {
      orders: ordersArray,
      pagination: res?.pagination || { total: ordersArray.length, page: 1, limit: 20, totalPages: 1 },
    };
  }
}
