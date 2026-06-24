import { Request, Response } from 'express';
import { whatsappProviderFactory } from '../providers/whatsapp-provider.factory';

export class WhatsAppSessionController {
  private readonly provider = whatsappProviderFactory.getProvider();

  public connect = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const status = await this.provider.connectSession(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  public disconnect = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const status = await this.provider.disconnectSession(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const status = await this.provider.getStatus(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
