import { api } from "../api";
import { Payment } from "../../types";

interface VerifyPaymentPayload {
  verifiedBy?: string;
  notes?: string;
  verifiedAmount?: number;
  verifiedTransactionReference?: string;
}

interface RejectPaymentPayload {
  reason: string;
}

interface ScreenshotUrlResponse {
  signedUrl: string;
  expiresIn: number;
}

export class PaymentsService {
  static async getPaymentsByRestaurant(restaurantId: string): Promise<Payment[]> {
    return api.get<Payment[]>(`/payments/restaurant/${restaurantId}`);
  }

  static async getPayment(paymentId: string): Promise<Payment> {
    return api.get<Payment>(`/payments/${paymentId}`);
  }

  static async verifyPayment(paymentId: string, payload: VerifyPaymentPayload): Promise<Payment> {
    return api.post<Payment>(`/payments/${paymentId}/verify`, payload);
  }

  static async rejectPayment(paymentId: string, payload: RejectPaymentPayload): Promise<Payment> {
    return api.post<Payment>(`/payments/${paymentId}/reject`, payload);
  }

  /**
   * Generates a short-lived signed URL for viewing a payment screenshot.
   * The backend calls StorageService — no public URL is ever exposed.
   */
  static async getScreenshotUrl(paymentId: string): Promise<ScreenshotUrlResponse> {
    return api.get<ScreenshotUrlResponse>(`/payments/${paymentId}/screenshot-url`);
  }

  /**
   * Fetches real-time status & configurations for all gateways of a restaurant.
   * Calls: GET /payments/config/:restaurantId
   */
  static async getGatewayConfigs(restaurantId: string): Promise<import("../../types").RestaurantPaymentConfig[]> {
    return api.get<import("../../types").RestaurantPaymentConfig[]>(`/payments/config/${restaurantId}`);
  }

  /**
   * Saves or updates a payment gateway configuration & tests credentials.
   * Calls: POST /payments/config
   */
  static async saveGatewayConfig(payload: import("../../types").SaveProviderConfigPayload): Promise<import("../../types").RestaurantPaymentConfig> {
    return api.post<import("../../types").RestaurantPaymentConfig>('/payments/config', payload);
  }

  /**
   * Runs a live health check on a payment gateway.
   * Calls: POST /payments/config/test
   */
  static async testGatewayConnection(payload: import("../../types").TestGatewayPayload): Promise<import("../../types").ProviderHealthCheckResult> {
    return api.post<import("../../types").ProviderHealthCheckResult>('/payments/config/test', payload);
  }
}
