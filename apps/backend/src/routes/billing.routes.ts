import { Router, Request, Response } from 'express';
import { asyncHandler } from '../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../middlewares/auth/restaurant-session.middleware';
import { ChargeRepository } from '../modules/billing/repositories/charge.repository';
import { BillingService } from '../modules/billing/services/billing.service';
import { SettingsRepository } from '../modules/restaurants/repositories/settings.repository';
import { BadRequestError } from '../shared/errors/app-error';

const router = Router();
const chargeRepo = new ChargeRepository();
const settingsRepo = new SettingsRepository();

/**
 * GET /api/v1/billing/charges
 * Fetch all configured charges for an authenticated restaurant session
 */
router.get(
  '/charges',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    if (!restaurantId) {
      throw new BadRequestError('Authenticated restaurant session required');
    }

    const charges = await chargeRepo.getCharges(restaurantId);
    const settings = await settingsRepo.getSettings(restaurantId);

    res.json({
      success: true,
      data: {
        charges,
        roundOffMode: (settings.settings as any).roundOffMode || 'nearest',
      },
    });
  })
);

/**
 * POST /api/v1/billing/charges
 * Create a new custom charge for an authenticated restaurant session
 */
router.post(
  '/charges',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const restaurantId = (req as any).restaurantId;
    const { name, type, calculationType, value, pricingType, scope, applyOn, showOnInvoice, enabled } = req.body;
    if (!restaurantId || !name || !type || !calculationType || value === undefined) {
      throw new BadRequestError('Authenticated restaurant session, name, type, calculationType, and value are required');
    }

    const created = await chargeRepo.createCharge(restaurantId, {
      name,
      type,
      calculationType,
      value: Number(value),
      pricingType: pricingType || 'exclusive',
      scope: scope || 'order',
      applyOn: Array.isArray(applyOn) ? applyOn : ['dining', 'takeaway', 'delivery'],
      showOnInvoice: showOnInvoice !== undefined ? Boolean(showOnInvoice) : true,
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      isSystem: false,
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  })
);

/**
 * PUT /api/v1/billing/charges/:chargeId
 * Update an existing charge configuration for an authenticated restaurant session
 */
router.put(
  '/charges/:chargeId',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const chargeId = req.params.chargeId as string;
    const restaurantId = (req as any).restaurantId;
    const updates = req.body;

    if (!chargeId || typeof chargeId !== 'string') {
      throw new BadRequestError('chargeId is required');
    }

    if (!restaurantId) {
      throw new BadRequestError('Authenticated restaurant session required');
    }

    const updated = await chargeRepo.updateCharge(restaurantId, chargeId, updates);

    res.json({
      success: true,
      data: updated,
    });
  })
);

/**
 * DELETE /api/v1/billing/charges/:chargeId
 * Delete a custom charge for an authenticated restaurant session
 */
router.delete(
  '/charges/:chargeId',
  restaurantSessionMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const chargeId = req.params.chargeId as string;
    const restaurantId = (req as any).restaurantId;

    if (!chargeId || typeof chargeId !== 'string') {
      throw new BadRequestError('chargeId is required');
    }

    if (!restaurantId) {
      throw new BadRequestError('Authenticated restaurant session required');
    }

    await chargeRepo.deleteCharge(restaurantId, chargeId);

    res.json({
      success: true,
      message: 'Charge deleted successfully',
    });
  })
);

/**
 * POST /api/v1/billing/calculate
 * Pure Billing Calculation Endpoint for Live Receipt Preview & Checkout
 */
router.post(
  '/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const { restaurantId, items, orderType, discountAmount, customCharges, roundOffMode } = req.body;

    let chargesToUse = customCharges;
    let effectiveRoundOff = roundOffMode;

    if (restaurantId && (!chargesToUse || chargesToUse.length === 0)) {
      chargesToUse = await chargeRepo.getCharges(restaurantId);
      if (!effectiveRoundOff) {
        const settings = await settingsRepo.getSettings(restaurantId);
        effectiveRoundOff = (settings.settings as any).roundOffMode || 'nearest';
      }
    }

    const breakdown = BillingService.calculate({
      items: items || [],
      charges: chargesToUse || [],
      discountAmount: Number(discountAmount || 0),
      orderType: orderType || 'takeaway',
      roundOffMode: effectiveRoundOff || 'nearest',
    });

    res.json({
      success: true,
      data: breakdown,
    });
  })
);

export default router;
