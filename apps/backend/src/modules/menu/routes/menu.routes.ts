import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new MenuController();

// ─── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', restaurantSessionMiddleware, asyncHandler(controller.listCategories));
router.post('/categories', restaurantSessionMiddleware, asyncHandler(controller.createCategory));
router.put('/categories/:categoryId', restaurantSessionMiddleware, asyncHandler(controller.updateCategory));
router.delete('/categories/:categoryId', restaurantSessionMiddleware, asyncHandler(controller.deleteCategory));
router.post('/categories/reorder', restaurantSessionMiddleware, asyncHandler(controller.reorderCategories));

// ─── Items ────────────────────────────────────────────────────────────────────
router.get('/items', restaurantSessionMiddleware, asyncHandler(controller.list));
router.post('/items', restaurantSessionMiddleware, asyncHandler(controller.create));
router.post('/items/reorder', restaurantSessionMiddleware, asyncHandler(controller.reorderItems));
router.put('/items/:itemId', restaurantSessionMiddleware, asyncHandler(controller.update));
router.patch('/items/:itemId/availability', restaurantSessionMiddleware, asyncHandler(controller.updateAvailability));
router.delete('/items/:itemId', restaurantSessionMiddleware, asyncHandler(controller.deleteItem));

// ─── Customizations ───────────────────────────────────────────────────────────
router.get('/items/:itemId/customizations', restaurantSessionMiddleware, asyncHandler(controller.listCustomizations));
router.post('/items/:itemId/customizations', restaurantSessionMiddleware, asyncHandler(controller.createCustomization));
router.put('/items/:itemId/customizations/:customizationId', restaurantSessionMiddleware, asyncHandler(controller.updateCustomization));
router.delete('/items/:itemId/customizations/:customizationId', restaurantSessionMiddleware, asyncHandler(controller.deleteCustomization));

export default router;
