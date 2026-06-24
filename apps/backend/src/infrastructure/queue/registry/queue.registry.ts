import { Queue } from 'bullmq';
import { QueueName } from '../types/queue.types';
import { QueueFactory } from '../factories/queue.factory';
import { logger } from '../../logger/logger';

/**
 * Centralized registry for all application queues.
 * This ensures all queues are initialized consistently and accessible from a single point.
 */
export class QueueRegistry {
  private static instance: QueueRegistry;
  private queues: Map<QueueName, Queue<any>> = new Map();

  private constructor() {}

  public static getInstance(): QueueRegistry {
    if (!QueueRegistry.instance) {
      QueueRegistry.instance = new QueueRegistry();
    }
    return QueueRegistry.instance;
  }

  /**
   * Initializes all application queues.
   * This should be called during application startup.
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing Queue Registry...');

    // Initialize all supported queues
    Object.values(QueueName).forEach((name) => {
      if (!this.queues.has(name)) {
        const queue = QueueFactory.createQueue(name);
        this.queues.set(name, queue);
      }
    });

    logger.info('✅ Queue Registry initialized successfully');
  }

  /**
   * Retrieves a specific queue by name.
   */
  public getQueue<T = any>(name: QueueName): Queue<T> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} has not been initialized in the registry.`);
    }
    return queue as Queue<T>;
  }

  /**
   * Gracefully shuts down all queues.
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down Queue Registry...');
    const shutdownPromises = Array.from(this.queues.values()).map((q) => q.close());
    await Promise.all(shutdownPromises);
    this.queues.clear();
    logger.info('Queue Registry shut down.');
  }
}

export const queueRegistry = QueueRegistry.getInstance();
