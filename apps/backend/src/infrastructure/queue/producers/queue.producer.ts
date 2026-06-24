import { Queue } from 'bullmq';
import { bullMQConfig } from '../bullmq.config';

export class QueueProducer {
  private queue: Queue;

  constructor(queueName: string) {
    this.queue = new Queue(queueName, bullMQConfig);
  }

  public async addJob(name: string, data: any) {
    return await this.queue.add(name, data);
  }
}
