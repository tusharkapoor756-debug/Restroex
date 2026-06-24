import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis;

  private constructor() {
    this.client = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => logger.info('✅ Redis connection established'));
    this.client.on('error', (error) => logger.error({ error }, '❌ Redis connection error'));
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.client.status === 'ready') return;
    
    return new Promise((resolve, reject) => {
      this.client.once('ready', resolve);
      this.client.once('error', reject);
    });
  }

  public getClient(): Redis {
    return this.client;
  }

  public async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info('Redis disconnected gracefully');
  }
}

export const redis = RedisClient.getInstance();
