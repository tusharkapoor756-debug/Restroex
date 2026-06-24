import { Request, Response } from 'express';
import { RestaurantSessionService } from '../services/restaurant-session.service';

export class RestaurantSessionController {
  private readonly sessions: RestaurantSessionService;

  constructor() {
    this.sessions = new RestaurantSessionService();
  }

  public login = async (req: Request, res: Response): Promise<void> => {
    const { name, phoneNumber } = req.body || {};
    const session = await this.sessions.login(String(name || '').trim(), String(phoneNumber || '').trim());
    res.status(200).json({
      success: true,
      data: session,
    });
  };
}
