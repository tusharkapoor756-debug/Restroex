import { Request, Response } from 'express';
import { MenuImportService } from '../services/menu-import.service';
import { MenuImportRepository } from '../repositories/menu-import.repository';

export class MenuImportController {
  private service = new MenuImportService();
  private repository = new MenuImportRepository();

  public uploadImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const restaurantId = (req as any).restaurantId || (req as any).user?.restaurantId || req.body.restaurantId;
      const file = req.file;

      if (!restaurantId) {
        res.status(400).json({ error: 'Restaurant ID is required' });
        return;
      }
      if (!file) {
        res.status(400).json({ error: 'Menu image or PDF file is required' });
        return;
      }

      const sessionId = await this.repository.createSession(
        restaurantId,
        file.originalname || 'uploaded_menu.png',
        'local://temp',
        req.body.importMode || 'append'
      );

      // Trigger background / direct end-to-end processing
      const categories = await this.service.processImageBuffer(
        sessionId,
        file.buffer,
        file.originalname || 'uploaded_menu.png'
      );

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          categories
        }
      });
    } catch (err: any) {
      console.error('[MenuImportController] Upload error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public parseOCR = async (req: Request, res: Response): Promise<void> => {

    try {
      const restaurantId = (req as any).restaurantId || (req as any).user?.restaurantId || req.body.restaurantId;
      const { tokens, originalFilename, importMode } = req.body;

      if (!restaurantId) {
        res.status(400).json({ error: 'Restaurant ID is required' });
        return;
      }
      if (!tokens || !Array.isArray(tokens)) {
        res.status(400).json({ error: 'Valid OCR tokens array is required' });
        return;
      }

      // Create session
      const sessionId = await this.repository.createSession(
        restaurantId,
        originalFilename || 'menu_scan.png',
        'local://temp',
        importMode || 'append'
      );

      // Process tokens asynchronously / synchronously for staging
      const categories = await this.service.processOCRTokens(sessionId, tokens);

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          categories
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public getSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const payload = await this.service.getSessionPreview(id);

      if (!payload) {
        res.status(404).json({ success: false, error: 'Import session not found' });
        return;
      }

      res.status(200).json({ success: true, data: payload });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  public commitSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const restaurantId = (req as any).restaurantId || (req as any).user?.restaurantId || req.body.restaurantId;
      const userId = (req as any).user?.id;

      if (!restaurantId) {
        res.status(400).json({ error: 'Restaurant ID is required' });
        return;
      }

      const result = await this.service.commitImportSession(restaurantId, id, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}
