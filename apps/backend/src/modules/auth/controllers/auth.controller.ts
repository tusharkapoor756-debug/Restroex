import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await this.authService.login(req.body);
      res.status(200).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  public async register(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await this.authService.register(req.body);
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  public async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const reset = await this.authService.forgotPassword(req.body);
      res.status(200).json({ success: true, data: reset });
    } catch (error) {
      next(error);
    }
  }
}
