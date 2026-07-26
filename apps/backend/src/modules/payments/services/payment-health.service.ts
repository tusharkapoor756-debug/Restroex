import { RestaurantPaymentConfigRepository } from '../repositories/restaurant-payment-config.repository';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { RestaurantPaymentConfig, GatewayConfigStatus } from '../types/payment.types';
import { ProviderHealthCheckResult } from '../providers/payment-provider.interface';
import { logger } from '../../../infrastructure/logger/logger';

export class PaymentHealthService {
  private readonly configRepo: RestaurantPaymentConfigRepository;

  constructor(configRepo?: RestaurantPaymentConfigRepository) {
    this.configRepo = configRepo ?? new RestaurantPaymentConfigRepository();
  }

  /**
   * Run live health check against payment provider for a restaurant
   */
  public async testGatewayConnection(
    restaurantId: string,
    providerName: string,
    overrideCredentials?: Record<string, any>
  ): Promise<ProviderHealthCheckResult> {
    const provider = PaymentProviderRegistry.get(providerName);
    const existing = await this.configRepo.getByRestaurantAndProvider(restaurantId, providerName);

    const credentialsToTest = overrideCredentials ?? existing?.credentials ?? {};
    const startTime = Date.now();

    try {
      const result = await provider.healthCheck(credentialsToTest);
      const latencyMs = Date.now() - startTime;
      result.latencyMs = latencyMs;

      // Update stored configuration status
      await this.configRepo.upsertConfig(restaurantId, providerName, {
        credentials: credentialsToTest,
        isEnabled: existing?.isEnabled,
        isSandbox: existing?.isSandbox,
        status: result.status,
        statusMessage: result.message,
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthCheckResponse: {
          ...result,
          checkedAt: new Date().toISOString(),
        },
      });

      logger.info(
        { restaurantId, providerName, status: result.status },
        '🩺 Gateway health check completed.'
      );

      return result;
    } catch (err: any) {
      const errorResult: ProviderHealthCheckResult = {
        isHealthy: false,
        status: 'provider_offline',
        message: err.message ?? 'Failed to perform provider health check',
        latencyMs: Date.now() - startTime,
      };

      await this.configRepo.upsertConfig(restaurantId, providerName, {
        credentials: credentialsToTest,
        isEnabled: existing?.isEnabled,
        isSandbox: existing?.isSandbox,
        status: 'provider_offline',
        statusMessage: errorResult.message,
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthCheckResponse: errorResult,
      });

      return errorResult;
    }
  }

  /**
   * Save or update restaurant payment configuration
   */
  public async saveProviderConfig(
    restaurantId: string,
    providerName: string,
    payload: {
      credentials: Record<string, any>;
      isEnabled?: boolean;
      isSandbox?: boolean;
      webhookSecret?: string;
    }
  ): Promise<RestaurantPaymentConfig> {
    const isEnabled = payload.isEnabled ?? false;
    const isSandbox = payload.isSandbox ?? true;
    // 1. First test credentials
    const healthResult = await this.testGatewayConnection(
      restaurantId,
      providerName,
      payload.credentials
    );

    // 2. Persist with updated status
    return this.configRepo.upsertConfig(restaurantId, providerName, {
      credentials: payload.credentials,
      isEnabled,
      isSandbox,
      webhookSecret: payload.webhookSecret,
      status: healthResult.status,
      statusMessage: healthResult.message,
      lastHealthCheckAt: new Date().toISOString(),
      lastHealthCheckResponse: healthResult,
    });
  }

  /**
   * Fetch health diagnostics for all configured gateways of a restaurant
   */
  public async getRestaurantGatewayStatuses(restaurantId: string): Promise<RestaurantPaymentConfig[]> {
    return this.configRepo.getAllByRestaurant(restaurantId);
  }
}
