import { Request, Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { WhatsAppConfigRepository } from '../repositories/whatsapp-config.repository';

export class SettingsController {
  private readonly settingsService: SettingsService;
  private readonly whatsappConfigRepo: WhatsAppConfigRepository;

  constructor() {
    this.settingsService = new SettingsService();
    this.whatsappConfigRepo = new WhatsAppConfigRepository();
  }

  public getSettings = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const data = await this.settingsService.getSettings(restaurantId);
    res.status(200).json({ success: true, data });
  };

  public updateSettings = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const data = await this.settingsService.updateSettings(restaurantId, req.body || {});
    res.status(200).json({ success: true, data });
  };

  public getWhatsAppConfig = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const data = await this.whatsappConfigRepo.getByRestaurantId(restaurantId);
    res.status(200).json({ success: true, data });
  };

  public updateWhatsAppConfig = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const data = await this.whatsappConfigRepo.upsert({
      restaurantId,
      orderingMode: req.body.orderingMode,
      homeScreenItems: req.body.homeScreenItems,
    });
    res.status(200).json({ success: true, data });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
