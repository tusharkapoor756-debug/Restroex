import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';

export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = new HealthService();
  }

  public async check(req: Request, res: Response) {
    const health = await this.healthService.getSystemHealth();
    const statusCode = health.status === 'UP' ? 200 : 503;
    res.status(statusCode).json(health);
  }
}
