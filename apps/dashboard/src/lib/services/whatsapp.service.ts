// src/lib/services/whatsapp.service.ts
import { api } from "../api";
import { WhatsAppSessionStatus, WhatsAppConversation } from "../../types";

export class WhatsAppService {
  /**
   * GET /whatsapp/session/status
   * Returns the current WhatsApp session state from the backend (Redis-persisted).
   */
  static async getStatus(): Promise<WhatsAppSessionStatus> {
    return api.get<WhatsAppSessionStatus>("/whatsapp/session/status");
  }

  /**
   * POST /whatsapp/session/connect
   * Starts a new WhatsApp Web.js session. Backend begins browser + QR generation.
   * Returns the initial status (usually 'reconnecting').
   */
  static async connect(): Promise<WhatsAppSessionStatus> {
    return api.post<WhatsAppSessionStatus>("/whatsapp/session/connect");
  }

  /**
   * POST /whatsapp/session/disconnect
   * Destroys the active WhatsApp session and clears auth directory.
   * Returns final disconnected status.
   */
  static async disconnect(): Promise<WhatsAppSessionStatus> {
    return api.post<WhatsAppSessionStatus>("/whatsapp/session/disconnect");
  }

  /**
   * Placeholder: No backend conversation listing endpoint exists yet.
   */
  static async listConversations(): Promise<WhatsAppConversation[]> {
    return [];
  }

  /**
   * GET /restaurants/settings/whatsapp-config
   */
  static async getWhatsAppConfig(): Promise<any> {
    return api.get<any>("/restaurants/settings/whatsapp-config");
  }

  /**
   * PUT /restaurants/settings/whatsapp-config
   */
  static async updateWhatsAppConfig(config: {
    orderingMode?: string;
    homeScreenItems?: string[];
    providerType?: "webjs" | "cloud_api";
    billingMode?: "self_managed" | "restroex_managed";
    numberVerificationStatus?: "pending" | "otp_sent" | "verified" | "failed";
    cloudPhoneNumberId?: string;
    cloudAccessToken?: string;
    cloudWabaId?: string;
    webhookVerifyToken?: string;
  }): Promise<any> {
    return api.put<any>("/restaurants/settings/whatsapp-config", config);
  }

  /**
   * POST /whatsapp/restroex-managed/register
   * Registers a phone number under Restroex's WABA and requests an OTP code.
   */
  static async registerRestroexManaged(whatsappNumber: string, codeMethod: "SMS" | "VOICE" = "SMS"): Promise<any> {
    return api.post<any>("/whatsapp/restroex-managed/register", { whatsappNumber, codeMethod });
  }

  /**
   * POST /whatsapp/restroex-managed/verify
   * Confirms the OTP code with Meta and activates Restroex-Managed Cloud API provider.
   */
  static async verifyRestroexManaged(otp: string): Promise<any> {
    return api.post<any>("/whatsapp/restroex-managed/verify", { otp });
  }

  /**
   * POST /whatsapp/restroex-managed/disconnect
   * Deregisters the restaurant's phone number from Meta Cloud API and resets local DB row.
   */
  static async disconnectRestroexManaged(): Promise<any> {
    return api.post<any>("/whatsapp/restroex-managed/disconnect");
  }

  /**
   * POST /whatsapp/test-message
   * Dispatches a real test message to verify WhatsApp provider delivery.
   */
  static async sendTestMessage(to: string, message: string): Promise<any> {
    return api.post<any>("/whatsapp/test-message", { to, message });
  }
}
