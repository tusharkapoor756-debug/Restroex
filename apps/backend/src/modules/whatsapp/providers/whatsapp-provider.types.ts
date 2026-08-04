export type WhatsAppProviderType = 'webjs' | 'cloud_api';

export type WhatsAppConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'expired';

export interface WhatsAppSessionStatus {
  restaurantId: string;
  providerType?: WhatsAppProviderType;
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
  mediaUrl?: string;
  documentUrl?: string;
  fileName?: string;
  interactive?: {
    type: 'button' | 'list';
    header?: string;
    body: string;
    footer?: string;
    action: any;
  };
  template?: {
    name: string;
    language?: string;
    components?: any[];
  };
}

export interface WhatsAppProvider {
  readonly providerType: WhatsAppProviderType;
  connectSession(restaurantId: string): Promise<WhatsAppSessionStatus>;
  disconnectSession(restaurantId: string): Promise<WhatsAppSessionStatus>;
  sendMessage(payload: SendMessagePayload): Promise<void>;
  getStatus(restaurantId: string): Promise<WhatsAppSessionStatus>;
}
