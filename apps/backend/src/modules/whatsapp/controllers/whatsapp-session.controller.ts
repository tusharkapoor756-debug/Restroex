import { Request, Response } from 'express';
import { whatsappProviderFactory } from '../providers/whatsapp-provider.factory';
import { WhatsAppMessageService } from '../message.service';

export class WhatsAppSessionController {
  private readonly messageService = new WhatsAppMessageService();

  public connect = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    const status = await provider.connectSession(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  public disconnect = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    const status = await provider.disconnectSession(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = this.getRestaurantId(req);
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    const status = await provider.getStatus(restaurantId);
    res.status(200).json({ success: true, data: status });
  };

  public sendTestMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const restaurantId = this.getRestaurantId(req);
      const { to, message } = req.body;
      if (!to || !message) {
        res.status(400).json({ success: false, error: 'Target phone number and message are required.' });
        return;
      }
      await this.messageService.sendText(restaurantId, to, message);
      res.status(200).json({ success: true, message: `Test message dispatched successfully to ${to}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to dispatch test message' });
    }
  };

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
