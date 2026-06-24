import { Request, Response } from 'express';
import { MenuService } from '../services/menu.service';

export class MenuController {
  private readonly menuService: MenuService;

  constructor() {
    this.menuService = new MenuService();
  }

  public list = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const items = await this.menuService.listMenu(restaurantId);
    res.status(200).json({ success: true, data: items });
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const item = await this.menuService.createMenuItem(restaurantId, req.body);
    res.status(201).json({ success: true, data: item });
  };

  public updateAvailability = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const item = await this.menuService.updateAvailability(
      restaurantId,
      String(req.params.itemId || ''),
      Boolean(req.body?.isAvailable)
    );
    res.status(200).json({ success: true, data: item });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
