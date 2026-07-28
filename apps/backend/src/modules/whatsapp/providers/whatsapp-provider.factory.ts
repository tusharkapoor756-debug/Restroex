import { WhatsAppProvider, WhatsAppProviderType } from './whatsapp-provider.types';
import { WhatsAppWebJsProvider } from './whatsapp-webjs.provider';
import { WhatsAppCloudApiProvider } from './whatsapp-cloud-api.provider';
import { WhatsAppConfigRepository } from '../../restaurants/repositories/whatsapp-config.repository';
import { redis } from '../../../infrastructure/redis/redis.client';
import { logger } from '../../../infrastructure/logger/logger';

class WhatsAppProviderFactory {
  private webjsProvider?: WhatsAppProvider;
  private cloudApiProvider?: WhatsAppProvider;
  private readonly configRepo = new WhatsAppConfigRepository();

  public getProvider(type: WhatsAppProviderType = 'webjs'): WhatsAppProvider {
    if (type === 'cloud_api') {
      if (!this.cloudApiProvider) {
        this.cloudApiProvider = new WhatsAppCloudApiProvider();
      }
      return this.cloudApiProvider;
    }

    if (!this.webjsProvider) {
      this.webjsProvider = new WhatsAppWebJsProvider();
    }
    return this.webjsProvider;
  }

  public async getProviderForRestaurant(restaurantId: string): Promise<WhatsAppProvider> {
    if (!restaurantId) return this.getProvider('webjs');

    try {
      // 1. Check Redis cache first (TTL 5 minutes)
      const redisClient = redis.getClient();
      const cacheKey = `whatsapp:provider_type:${restaurantId}`;
      const cachedType = await redisClient.get(cacheKey);

      if (cachedType === 'cloud_api' || cachedType === 'webjs') {
        return this.getProvider(cachedType);
      }

      // 2. Fetch from DB Repository
      const config = await this.configRepo.getByRestaurantId(restaurantId);
      const providerType = config.providerType || 'webjs';

      // 3. Cache resolved type in Redis
      await redisClient.set(cacheKey, providerType, 'EX', 300);

      return this.getProvider(providerType);
    } catch (err) {
      logger.warn({ err, restaurantId }, 'Failed to resolve WhatsApp provider for restaurant. Defaulting to webjs.');
      return this.getProvider('webjs');
    }
  }

  public async invalidateCache(restaurantId: string): Promise<void> {
    try {
      await redis.getClient().del(`whatsapp:provider_type:${restaurantId}`);
    } catch {
      // Non-critical
    }
  }
}

export const whatsappProviderFactory = new WhatsAppProviderFactory();
