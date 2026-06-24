import { Request, Response } from 'express';
import { RestaurantService } from '../services/restaurant.service';

export class RestaurantController {
  private readonly restaurants: RestaurantService;

  constructor() {
    this.restaurants = new RestaurantService();
  }

  public getSetup = async (req: Request, res: Response): Promise<void> => {
    const setup = await this.restaurants.getSetup(this.getRestaurantId(req));
    res.status(200).json({ success: true, data: setup });
  };

  public updateSetup = async (req: Request, res: Response): Promise<void> => {
    const setup = await this.restaurants.updateSetup(this.getRestaurantId(req), req.body || {});
    res.status(200).json({ success: true, data: setup });
  };

  public completeSetup = async (req: Request, res: Response): Promise<void> => {
    const setup = await this.restaurants.completeSetup(this.getRestaurantId(req), req.body || {});
    res.status(200).json({ success: true, data: setup });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
