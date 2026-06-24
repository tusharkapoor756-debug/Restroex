import { Worker, Job } from 'bullmq';
import { bullMQConfig } from '../bullmq.config';

export class QueueConsumer {
  private worker: Worker;

  constructor(queueName: string, processor: (job: Job) => Promise<void>) {
    this.worker = new Worker(queueName, processor, bullMQConfig);
  }

  public onCompleted(handler: (job: Job) => void) {
    this.worker.on('completed', handler);
  }

  public onError(handler: (error: Error) => void) {
    this.worker.on('failed', (job: Job | undefined, err: Error) => handler(err));
  }
}
