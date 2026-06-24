import { ConnectionOptions, DefaultJobOptions } from 'bullmq';
import { env } from '../../../config/env';

/**
 * Standard Redis connection configuration for BullMQ.
 */
export const redisConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // maxRetriesPerRequest must be null for BullMQ
  maxRetriesPerRequest: null,
};

/**
 * Standardized job options for all queues.
 * Ensures consistent retry behavior and cleanup policies.
 */
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s...
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep for 24 hours
    count: 1000,    // Keep last 1000 jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep for 7 days
  },
};
