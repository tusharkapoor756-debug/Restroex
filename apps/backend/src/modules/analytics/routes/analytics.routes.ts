import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new AnalyticsController();

router.get('/analytics/daily', restaurantSessionMiddleware, asyncHandler(controller.getDailyAnalytics));

export default router;
