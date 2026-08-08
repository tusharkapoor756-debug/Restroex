import { Router, Request, Response } from 'express';
import { asyncHandler } from '../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../middlewares/auth/restaurant-session.middleware';
import { comboService } from '../modules/menu/services/combo.service';
import { BadRequestError } from '../shared/errors/app-error';

const router = Router();

/**
 * GET /api/v1/combos
 * Fetch all combos for authenticated restaurant
 */
router.get(
  '/combos',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    if (!restaurantId) throw new BadRequestError('Authenticated restaurant session required');

    const combos = await comboService.getCombos(restaurantId);
    res.json({ success: true, data: combos });
  })
);

/**
 * POST /api/v1/combos
 * Create a new combo deal
 */
router.post(
  '/combos',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    if (!restaurantId) throw new BadRequestError('Authenticated restaurant session required');

    const created = await comboService.createCombo(restaurantId, req.body || {});
    res.status(201).json({ success: true, data: created });
  })
);

/**
 * PATCH /api/v1/combos/:id
 * Update an existing combo
 */
router.patch(
  '/combos/:id',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    const comboId = req.params.id as string;
    if (!restaurantId || !comboId) throw new BadRequestError('comboId is required');

    const updated = await comboService.updateCombo(restaurantId, comboId, req.body || {});
    res.json({ success: true, data: updated });
  })
);

/**
 * DELETE /api/v1/combos/:id
 * Delete a combo
 */
router.delete(
  '/combos/:id',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    const comboId = req.params.id as string;
    if (!restaurantId || !comboId) throw new BadRequestError('comboId is required');

    await comboService.deleteCombo(restaurantId, comboId);
    res.json({ success: true, message: 'Combo deleted successfully' });
  })
);

export default router;
