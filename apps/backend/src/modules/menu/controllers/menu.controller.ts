import { Request, Response } from 'express';
import { MenuService } from '../services/menu.service';

export class MenuController {
  private readonly menuService: MenuService;

  constructor() {
    this.menuService = new MenuService();
  }

  /**
   * GET /menu/items
   * Returns all menu items with their variants.
   */
  public list = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const items = await this.menuService.listMenuWithVariants(restaurantId);
    res.status(200).json({ success: true, data: items });
  };

  /**
   * POST /menu/items
   * Creates a new menu item, optionally with variants.
   */
  public create = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const item = await this.menuService.createMenuItem(restaurantId, req.body);
    res.status(201).json({ success: true, data: item });
  };

  /**
   * PUT /menu/items/:itemId
   * Updates a menu item and replaces its variants.
   */
  public update = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const itemId = String(req.params.itemId || '');
    const item = await this.menuService.updateMenuItem(restaurantId, itemId, req.body);
    res.status(200).json({ success: true, data: item });
  };

  /**
   * PATCH /menu/items/:itemId/availability
   * Toggles item availability.
   */
  public updateAvailability = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const item = await this.menuService.updateAvailability(
      restaurantId,
      String(req.params.itemId || ''),
      Boolean(req.body?.isAvailable),
    );
    res.status(200).json({ success: true, data: item });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
