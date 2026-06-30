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
}
