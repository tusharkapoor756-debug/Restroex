import { QueueOptions } from 'bullmq';
import { redis } from '../redis/redis.client';

export const bullMQConfig: QueueOptions = {
  connection: redis.getClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
};
