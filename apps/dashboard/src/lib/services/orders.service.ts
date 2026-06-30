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
}
