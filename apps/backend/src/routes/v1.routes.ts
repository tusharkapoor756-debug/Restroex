import { Router } from 'express';
import healthRoutes from '../modules/health/routes/health.routes';
import authRoutes from '../modules/auth/routes/auth.routes';
import restaurantRoutes from '../modules/restaurants/routes/restaurant.routes';
import whatsappRoutes from '../modules/whatsapp/routes/whatsapp.routes';
import paymentRoutes from '../modules/payments/routes/payment.routes';
import receiptRoutes from '../modules/orders/routes/receipt.routes';
import orderRoutes from '../modules/orders/routes/order.routes';
import menuRoutes from '../modules/menu/routes/menu.routes';

const router = Router();

/**
 * API v1 Route Registration
 */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/restaurants', restaurantRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/payments', paymentRoutes);
router.use('/menu', menuRoutes);
router.use(orderRoutes);
router.use(receiptRoutes);


// Feature modules will be registered here:
// router.use('/orders', orderRoutes);
// router.use('/ai', aiRoutes);

export default router;
