import { api } from "../api";
import { Payment } from "../../types";

interface VerifyPaymentPayload {
  verifiedBy: string;
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
}
