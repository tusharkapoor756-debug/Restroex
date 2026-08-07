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
   * For cancellations, an optional human-readable reason can be provided.
   * The reason will be sent to the customer via WhatsApp.
   */
  static async transitionOrder(orderId: string, status: WorkflowOrderStatus, cancellationReason?: string): Promise<Order> {
    const body: Record<string, unknown> = { status };
    if (cancellationReason) body.cancellationReason = cancellationReason;
    return api.patch<Order>(`/orders/${orderId}/status`, body);
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
    const rawRes = await api.getRaw<any>(`/orders/history${queryString}`);
    
    const ordersArray = Array.isArray(rawRes?.data) ? rawRes.data : [];
    const pagination = rawRes?.pagination || {
      total: ordersArray.length,
      page: params?.page || 1,
      limit: params?.limit || 20,
      totalPages: Math.ceil(ordersArray.length / (params?.limit || 20)) || 1
    };

    return {
      orders: ordersArray,
      pagination,
    };
  }

  /**
   * Fetches a single order by its internal UUID.
   * Used by the Payments page to deep-link View Order → auto-open the Order Details drawer.
   */
  static async getOrderById(orderId: string): Promise<Order> {
    const rawRes = await api.getRaw<any>(`/orders/${orderId}`);
    return rawRes?.data ?? rawRes;
  }
}
