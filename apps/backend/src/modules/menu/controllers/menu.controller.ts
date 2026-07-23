import { Request, Response } from 'express';
import { MenuService } from '../services/menu.service';

export class MenuController {
  private readonly menuService: MenuService;

  constructor() {
    this.menuService = new MenuService();
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  public listCategories = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const categories = await this.menuService.listCategories(restaurantId);
    res.status(200).json({ success: true, data: categories });
  };

  public createCategory = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const category = await this.menuService.createCategory(restaurantId, req.body);
    res.status(201).json({ success: true, data: category });
  };

  public updateCategory = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const categoryId = String(req.params.categoryId || '');
    const category = await this.menuService.updateCategory(restaurantId, categoryId, req.body);
    res.status(200).json({ success: true, data: category });
  };

  public deleteCategory = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const categoryId = String(req.params.categoryId || '');
    await this.menuService.deleteCategory(restaurantId, categoryId);
    res.status(204).end();
  };

  public reorderCategories = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    await this.menuService.reorderCategories(restaurantId, req.body);
    res.status(200).json({ success: true });
  };

  // ─── Menu Items ───────────────────────────────────────────────────────────

  /**
   * GET /menu/items
   * Returns all menu items with their variants and customizations.
   */
  public list = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const items = await this.menuService.listMenuWithVariants(restaurantId);
    res.status(200).json({ success: true, data: items });
  };

  /**
   * POST /menu/items
   * Creates a new menu item with optional variants, category assignment, and all dynamic fields.
   */
  public create = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const item = await this.menuService.createMenuItem(restaurantId, req.body);
    res.status(201).json({ success: true, data: item });
  };

  /**
   * PUT /menu/items/:itemId
   * Updates a menu item and optionally replaces its variants.
   */
  public update = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const itemId = String(req.params.itemId || '');
    const item = await this.menuService.updateMenuItem(restaurantId, itemId, req.body);
    res.status(200).json({ success: true, data: item });
  };

  /**
   * PATCH /menu/items/:itemId/availability
   * Toggles item availability (also invalidates AI context cache).
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

  /**
   * POST /menu/items/reorder
   * Accepts { items: [{ id, displayOrder }] } to persist drag-and-drop order.
   */
  public reorderItems = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    await this.menuService.reorderItems(restaurantId, req.body);
    res.status(200).json({ success: true });
  };

  public deleteItem = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const itemId = String(req.params.itemId || '');
    await this.menuService.deleteMenuItem(restaurantId, itemId);
    res.status(204).end();
  };

  // ─── Customizations ───────────────────────────────────────────────────────

  public listCustomizations = async (req: Request, res: Response): Promise<void> => {
    const menuItemId = String(req.params.itemId || '');
    const customizations = await this.menuService.listCustomizations(menuItemId);
    res.status(200).json({ success: true, data: customizations });
  };

  public createCustomization = async (req: Request, res: Response): Promise<void> => {
    const menuItemId = String(req.params.itemId || '');
    const customization = await this.menuService.createCustomization(menuItemId, req.body);
    res.status(201).json({ success: true, data: customization });
  };

  public updateCustomization = async (req: Request, res: Response): Promise<void> => {
    const customizationId = String(req.params.customizationId || '');
    const customization = await this.menuService.updateCustomization(customizationId, req.body);
    res.status(200).json({ success: true, data: customization });
  };

  public deleteCustomization = async (req: Request, res: Response): Promise<void> => {
    const customizationId = String(req.params.customizationId || '');
    await this.menuService.deleteCustomization(customizationId);
    res.status(204).end();
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
