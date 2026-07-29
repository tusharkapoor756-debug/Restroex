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
    console.log(`📥 [SettingsController] GET /api/v1/restaurants/settings requested for restaurantId: ${restaurantId}`);
    const data = await this.settingsService.getSettings(restaurantId);
    res.status(200).json({ success: true, data });
  };

  public updateSettings = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    console.log(`📥 [SettingsController] PATCH /api/v1/restaurants/settings requested for restaurantId: ${restaurantId}. Body:`, req.body);
    const data = await this.settingsService.updateSettings(restaurantId, req.body || {});
    console.log(`✅ [SettingsController] PATCH /api/v1/restaurants/settings successfully updated database for restaurantId: ${restaurantId}`);
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
      providerType: req.body.providerType,
      cloudPhoneNumberId: req.body.cloudPhoneNumberId,
      cloudAccessToken: req.body.cloudAccessToken,
      cloudWabaId: req.body.cloudWabaId,
      webhookVerifyToken: req.body.webhookVerifyToken,
    });
    const { whatsappProviderFactory } = require('../../whatsapp/providers/whatsapp-provider.factory');
    await whatsappProviderFactory.invalidateCache(restaurantId);
    res.status(200).json({ success: true, data });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
