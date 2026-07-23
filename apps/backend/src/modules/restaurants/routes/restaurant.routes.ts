import { Router } from 'express';
import { RestaurantSessionController } from '../controllers/restaurant-session.controller';
import { RestaurantController } from '../controllers/restaurant.controller';
import { SettingsController } from '../controllers/settings.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const sessionController = new RestaurantSessionController();
const restaurantController = new RestaurantController();
const settingsController = new SettingsController();

router.post('/login', asyncHandler(sessionController.login));
router.get('/setup', restaurantSessionMiddleware, asyncHandler(restaurantController.getSetup));
router.patch('/setup', restaurantSessionMiddleware, asyncHandler(restaurantController.updateSetup));
router.post('/setup/complete', restaurantSessionMiddleware, asyncHandler(restaurantController.completeSetup));

// ─── Restaurant Settings Module ────────────────────────────────────────────
router.get('/settings', restaurantSessionMiddleware, asyncHandler(settingsController.getSettings));
router.patch('/settings', restaurantSessionMiddleware, asyncHandler(settingsController.updateSettings));
router.get('/settings/whatsapp-config', restaurantSessionMiddleware, asyncHandler(settingsController.getWhatsAppConfig));
router.put('/settings/whatsapp-config', restaurantSessionMiddleware, asyncHandler(settingsController.updateWhatsAppConfig));

export default router;
