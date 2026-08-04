import { logger } from '../../../infrastructure/logger/logger';
import { redis } from '../../../infrastructure/redis/redis.client';
import { WhatsAppConfigRepository } from '../../restaurants/repositories/whatsapp-config.repository';
import {
  SendMessagePayload,
  WhatsAppProvider,
  WhatsAppSessionStatus,
} from './whatsapp-provider.types';

export class WhatsAppCloudApiProvider implements WhatsAppProvider {
  readonly providerType = 'cloud_api' as const;
  private readonly configRepo = new WhatsAppConfigRepository();
  private readonly apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || 'v19.0';
  private readonly graphBaseUrl = 'https://graph.facebook.com';

  public async connectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    logger.info({ restaurantId }, 'WhatsAppCloudApiProvider.connectSession called');

    const config = await this.configRepo.getByRestaurantId(restaurantId);
    const { phoneNumberId, accessToken } = this.resolveCredentials(config);

    if (!phoneNumberId || !accessToken) {
      const failedStatus: WhatsAppSessionStatus = {
        restaurantId,
        providerType: 'cloud_api',
        state: 'disconnected',
        lastError: config.billingMode === 'restroex_managed'
          ? 'Restroex-Managed WhatsApp number verification pending.'
          : 'Missing Meta Cloud API credentials (Phone Number ID or Access Token).',
      };
      await this.persistStatus(failedStatus);
      return failedStatus;
    }

    try {
      // Validate credentials against Meta Graph API
      const url = `${this.graphBaseUrl}/${this.apiVersion}/${phoneNumberId}`;
      const res = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }, 8000);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Meta API error (${res.status}): ${JSON.stringify(errorData)}`);
      }

      const data: any = await res.json();
      const connectedPhone = data.display_phone_number || data.verified_name || phoneNumberId;

      const status: WhatsAppSessionStatus = {
        restaurantId,
        providerType: 'cloud_api',
        state: 'connected',
        connectedPhone,
        lastConnectedAt: new Date().toISOString(),
      };

      await this.persistStatus(status);
      logger.info({ restaurantId, connectedPhone }, 'WhatsApp Cloud API session connected successfully');
      return status;
    } catch (err: any) {
      const errorMsg = err?.message || 'Meta Cloud API validation failed';
      logger.error({ err, restaurantId }, 'WhatsApp Cloud API connection error');

      const failedStatus: WhatsAppSessionStatus = {
        restaurantId,
        providerType: 'cloud_api',
        state: 'disconnected',
        lastError: errorMsg,
      };
      await this.persistStatus(failedStatus);
      return failedStatus;
    }
  }

  public async disconnectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    logger.info({ restaurantId }, 'WhatsAppCloudApiProvider.disconnectSession called');

    const status: WhatsAppSessionStatus = {
      restaurantId,
      providerType: 'cloud_api',
      state: 'disconnected',
      lastDisconnectedAt: new Date().toISOString(),
    };

    await this.persistStatus(status);
    return status;
  }

  public async getStatus(restaurantId: string): Promise<WhatsAppSessionStatus> {
    const raw = await redis.getClient().get(`whatsapp:session:${restaurantId}:status`);
    if (raw) {
      try {
        const status = JSON.parse(raw) as WhatsAppSessionStatus;
        if (status.providerType === 'cloud_api') return status;
      } catch {
        // Fall back to live connect check below
      }
    }
    return this.connectSession(restaurantId);
  }

  public async sendMessage(payload: SendMessagePayload): Promise<void> {
    const { restaurantId, to, body, mediaUrl, interactive, template } = payload;
    logger.info({ restaurantId, to }, 'WhatsAppCloudApiProvider.sendMessage called');

    const config = await this.configRepo.getByRestaurantId(restaurantId);
    const { phoneNumberId, accessToken } = this.resolveCredentials(config);

    if (!phoneNumberId || !accessToken) {
      throw new Error(`WhatsApp Cloud API credentials not configured for restaurant ${restaurantId}`);
    }

    const formattedTo = this.formatPhoneNumber(to);
    let messageBody: Record<string, any>;

    if (interactive) {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'interactive',
        interactive,
      };
    } else if (template) {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'template',
        template,
      };
    } else if (payload.documentUrl) {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'document',
        document: {
          link: payload.documentUrl,
          filename: payload.fileName || 'document.pdf',
          caption: body || undefined,
        },
      };
    } else if (mediaUrl) {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'image',
        image: {
          link: mediaUrl,
          caption: body || undefined,
        },
      };
    } else {
      messageBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'text',
        text: {
          preview_url: false,
          body,
        },
      };
    }

    const url = `${this.graphBaseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;
    await this.postWithRetry(url, accessToken, messageBody);
  }

  private async postWithRetry(url: string, accessToken: string, payload: any, maxRetries = 3): Promise<void> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }, 10000);

        if (response.ok) {
          logger.info({ attempt }, 'WhatsApp Cloud API message sent successfully');
          return;
        }

        const errData = await response.json().catch(() => ({}));
        lastError = new Error(`Meta API error HTTP ${response.status}: ${JSON.stringify(errData)}`);

        if (response.status >= 500 || response.status === 429) {
          logger.warn({ attempt, status: response.status }, 'Transient Meta API error. Retrying with backoff...');
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }

        // Fatal 4xx error (e.g. invalid recipient, bad request) — do not retry
        throw lastError;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
    }

    logger.error({ error: lastError }, 'WhatsApp Cloud API sendMessage failed after retries');
    throw lastError;
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    // If 10 digits without country code, default to India +91 prefix
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    return cleaned;
  }

  private resolveCredentials(config: any): { phoneNumberId?: string; accessToken?: string } {
    if (config.billingMode === 'restroex_managed') {
      return {
        phoneNumberId: config.cloudPhoneNumberId,
        accessToken: process.env.RESTROEX_WHATSAPP_SYSTEM_USER_TOKEN,
      };
    }
    return {
      phoneNumberId: config.cloudPhoneNumberId || process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID,
      accessToken: config.cloudAccessToken || process.env.WHATSAPP_CLOUD_ACCESS_TOKEN,
    };
  }

  private async persistStatus(status: WhatsAppSessionStatus): Promise<void> {
    try {
      const redisClient = redis.getClient();
      await redisClient.set(
        `whatsapp:session:${status.restaurantId}:status`,
        JSON.stringify(status)
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to persist WhatsApp Cloud API status to Redis');
    }
  }
}
