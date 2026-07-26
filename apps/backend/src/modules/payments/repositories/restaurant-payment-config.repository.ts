import { db } from '../../../infrastructure/database/database.client';
import { RestaurantPaymentConfig, GatewayConfigStatus } from '../types/payment.types';

export class RestaurantPaymentConfigRepository {
  private client = db.getClient();
  private inMemoryConfigs = new Map<string, Map<string, RestaurantPaymentConfig>>();

  public async getByRestaurantAndProvider(
    restaurantId: string,
    providerName: string
  ): Promise<RestaurantPaymentConfig | null> {
    const { data, error } = await this.client
      .from('restaurant_payment_configs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('provider_name', providerName)
      .maybeSingle();

    if (error) {
      const { logger } = require('../../../infrastructure/logger/logger');
      logger.error({ error: error.message, restaurantId, providerName }, '⚠️ Failed to fetch gateway config from Supabase DB');
    }

    if (error || !data) {
      // Fallback in-memory store check
      const restMap = this.inMemoryConfigs.get(restaurantId);
      return restMap?.get(providerName) ?? null;
    }

    return this.mapToDomain(data);
  }

  public async getAllByRestaurant(restaurantId: string): Promise<RestaurantPaymentConfig[]> {
    const { data, error } = await this.client
      .from('restaurant_payment_configs')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (error) {
      const { logger } = require('../../../infrastructure/logger/logger');
      logger.error({ error: error.message, restaurantId }, '⚠️ Failed to fetch all gateway configs from Supabase DB');
    }

    if (error || !data) {
      const restMap = this.inMemoryConfigs.get(restaurantId);
      return restMap ? [...restMap.values()] : [];
    }

    return data.map((row) => this.mapToDomain(row));
  }

  public async upsertConfig(
    restaurantId: string,
    providerName: string,
    payload: {
      isEnabled?: boolean;
      isSandbox?: boolean;
      credentials?: Record<string, any>;
      status?: GatewayConfigStatus;
      statusMessage?: string;
      lastHealthCheckAt?: string;
      lastHealthCheckResponse?: Record<string, any>;
      webhookSecret?: string;
    }
  ): Promise<RestaurantPaymentConfig> {
    const existing = await this.getByRestaurantAndProvider(restaurantId, providerName);

    const mergedCredentials = {
      ...(existing?.credentials ?? {}),
      ...(payload.credentials ?? {}),
    };

    const rowPayload = {
      restaurant_id: restaurantId,
      provider_name: providerName,
      is_enabled: payload.isEnabled ?? existing?.isEnabled ?? false,
      is_sandbox: payload.isSandbox ?? existing?.isSandbox ?? true,
      credentials: mergedCredentials,
      status: payload.status ?? existing?.status ?? 'not_connected',
      status_message: payload.statusMessage ?? existing?.statusMessage ?? null,
      last_health_check_at: payload.lastHealthCheckAt ?? existing?.lastHealthCheckAt ?? null,
      last_health_check_response: payload.lastHealthCheckResponse ?? existing?.lastHealthCheckResponse ?? null,
      webhook_secret: payload.webhookSecret ?? existing?.webhookSecret ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('restaurant_payment_configs')
      .upsert(rowPayload, { onConflict: 'restaurant_id,provider_name' })
      .select('*')
      .maybeSingle();

    if (error) {
      const { logger } = require('../../../infrastructure/logger/logger');
      logger.error({ error: error.message, restaurantId, providerName }, '❌ Supabase DB upsert failed in restaurant_payment_configs');
    }

    if (error || !data) {
      // In-memory fallback
      const domain: RestaurantPaymentConfig = {
        id: existing?.id ?? `rpc_${Date.now()}`,
        restaurantId,
        providerName,
        isEnabled: rowPayload.is_enabled,
        isSandbox: rowPayload.is_sandbox,
        credentials: rowPayload.credentials,
        status: rowPayload.status,
        statusMessage: rowPayload.status_message,
        lastHealthCheckAt: rowPayload.last_health_check_at,
        lastHealthCheckResponse: rowPayload.last_health_check_response,
        webhookSecret: rowPayload.webhook_secret,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: rowPayload.updated_at,
      };

      if (!this.inMemoryConfigs.has(restaurantId)) {
        this.inMemoryConfigs.set(restaurantId, new Map());
      }
      this.inMemoryConfigs.get(restaurantId)!.set(providerName, domain);
      return domain;
    }

    return this.mapToDomain(data);
  }

  private mapToDomain(row: any): RestaurantPaymentConfig {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      providerName: row.provider_name,
      isEnabled: Boolean(row.is_enabled),
      isSandbox: Boolean(row.is_sandbox),
      credentials: row.credentials ?? {},
      status: row.status as GatewayConfigStatus,
      statusMessage: row.status_message,
      lastHealthCheckAt: row.last_health_check_at,
      lastHealthCheckResponse: row.last_health_check_response,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
