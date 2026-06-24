export type WhatsAppConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'expired';

export interface WhatsAppSessionStatus {
  restaurantId: string;
  state: WhatsAppConnectionState;
  qrCode?: string;
  qrCodeDataUrl?: string;
  connectedPhone?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastError?: string;
}

export interface SendMessagePayload {
  restaurantId: string;
  to: string;
  body: string;
}

export interface WhatsAppProvider {
  connectSession(restaurantId: string): Promise<WhatsAppSessionStatus>;
  disconnectSession(restaurantId: string): Promise<WhatsAppSessionStatus>;
  sendMessage(payload: SendMessagePayload): Promise<void>;
  getStatus(restaurantId: string): Promise<WhatsAppSessionStatus>;
}
