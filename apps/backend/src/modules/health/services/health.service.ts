import { db } from '../../../infrastructure/database/database.client';
import { redis } from '../../../infrastructure/redis/redis.client';
import { getQueueHealthStatus } from '../../../infrastructure/queue';

/**
 * HealthService provides system-wide health status.
 * Optimized for performance by using the connection state maintained by infrastructure clients
 * instead of performing network roundtrips on every request.
 */
export class HealthService {
  public async getSystemHealth() {
    const dbStatus = this.checkDatabase();
    const redisStatus = this.checkRedis();
    const queueStatus = this.checkQueue();

    const isHealthy = 
      dbStatus === 'CONNECTED' && 
      redisStatus === 'CONNECTED' && 
      queueStatus === 'CONNECTED';

    return {
      status: isHealthy ? 'UP' : 'DOWN',
      database: dbStatus,
      redis: redisStatus,
      queue: queueStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns the database connection status from the cached state.
   */
  private checkDatabase(): string {
    return db.getConnectionStatus();
  }

  /**
   * Returns the Redis connection status.
   */
  private checkRedis(): string {
    try {
      const status = redis.getClient().status;
      return status === 'ready' ? 'CONNECTED' : 'DISCONNECTED';
    } catch {
      return 'DISCONNECTED';
    }
  }

  /**
   * Returns the Queue infrastructure status.
   */
  private checkQueue(): string {
    return getQueueHealthStatus();
  }
}
