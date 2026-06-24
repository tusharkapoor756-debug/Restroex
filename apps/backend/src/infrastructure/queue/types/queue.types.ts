/**
 * Supported Queue Names in the Restroex ecosystem.
 */
export enum QueueName {
  WHATSAPP_INCOMING = 'whatsapp-incoming',
  AI_PROCESSING = 'ai-processing',
  NOTIFICATIONS = 'notifications',
  PAYMENT_RECONCILIATION = 'payment-reconciliation',
  ORDER_EVENTS = 'order-events',
}

/**
 * Base interface for all job payloads.
 * Ensures every job has a traceId for logging/tracking.
 */
export interface BaseJobPayload {
  traceId: string;
  timestamp: string;
}

/**
 * Placeholder types for specific job payloads.
 * These will be expanded as business logic is implemented.
 */
export interface WhatsAppJobPayload extends BaseJobPayload {
  platform: 'whatsapp';
  restaurantId: string;
  messageId: string;
  from: string;
  customerPhone?: string;
  textBody?: string;
  content: any;
}

export interface AIProcessingPayload extends BaseJobPayload {
  context: string;
  input: string;
}

export interface NotificationPayload extends BaseJobPayload {
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  restaurantId?: string;
  recipient: string;
  body: string;
}
