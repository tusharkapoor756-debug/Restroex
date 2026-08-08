import { Router, Request, Response } from 'express';
import { asyncHandler } from '../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../middlewares/auth/restaurant-session.middleware';
import { couponService } from '../modules/marketing/services/coupon.service';
import { BadRequestError } from '../shared/errors/app-error';

const router = Router();

/**
 * GET /api/v1/marketing/coupons
 * Fetch all coupons for an authenticated restaurant session
 */
router.get(
  '/coupons',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    if (!restaurantId) throw new BadRequestError('Authenticated restaurant session required');

    const coupons = await couponService.getCoupons(restaurantId);
    res.json({ success: true, data: coupons });
  })
);

/**
 * POST /api/v1/marketing/coupons
 * Create a new coupon for an authenticated restaurant session
 */
router.post(
  '/coupons',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    if (!restaurantId) throw new BadRequestError('Authenticated restaurant session required');

    const created = await couponService.createCoupon(restaurantId, req.body || {});
    res.status(201).json({ success: true, data: created });
  })
);

/**
 * PATCH /api/v1/marketing/coupons/:id
 * Update an existing coupon
 */
router.patch(
  '/coupons/:id',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    const couponId = req.params.id as string;
    if (!restaurantId || !couponId) throw new BadRequestError('couponId is required');

    const updated = await couponService.updateCoupon(restaurantId, couponId, req.body || {});
    res.json({ success: true, data: updated });
  })
);

/**
 * DELETE /api/v1/marketing/coupons/:id
 * Delete a coupon
 */
router.delete(
  '/coupons/:id',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    const couponId = req.params.id as string;
    if (!restaurantId || !couponId) throw new BadRequestError('couponId is required');

    await couponService.deleteCoupon(restaurantId, couponId);
    res.json({ success: true, message: 'Coupon deleted successfully' });
  })
);

export default router;
