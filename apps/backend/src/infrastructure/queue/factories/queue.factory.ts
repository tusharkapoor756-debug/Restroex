import { Queue, QueueOptions } from 'bullmq';
import { redisConnection, defaultJobOptions } from '../config/queue.config';
import { logger } from '../../logger/logger';
import { QueueName } from '../types/queue.types';

/**
 * Factory for creating standardized BullMQ Queue instances.
 * 
 * Simplified typing to avoid BullMQ internal generic complexity while 
 * preserving practical type safety for the application layer.
 */
export class QueueFactory {
  /**
   * Creates a new queue with standardized defaults and connection.
   * Uses 'any' internally to bypass complex BullMQ type compatibility issues
   * but returns a typed Queue<T> for the caller.
   */
  public static createQueue<T = any>(
    name: QueueName, 
    options: Partial<QueueOptions> = {}
  ): Queue<T> {
    const queueConfig: any = {
      connection: redisConnection,
      defaultJobOptions,
      ...options,
    };

    const queue = new Queue(name, queueConfig);

    logger.info({ queue: name }, `📦 Queue initialized: ${name}`);

    // Basic error handling for the queue itself
    queue.on('error', (error) => {
      logger.error({ queue: name, error }, `❌ Queue error: ${name}`);
    });

    return queue as unknown as Queue<T>;
  }
}
