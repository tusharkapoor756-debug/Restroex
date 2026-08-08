import { Router, Request, Response } from 'express';
import { PublicBootstrapService } from '../modules/restaurants/services/public-bootstrap.service';
import { OrderService } from '../modules/orders/services/order.service';
import { PaymentOrchestratorService } from '../modules/payments/services/payment-orchestrator.service';
import { RestaurantRepository } from '../modules/restaurants/repositories/restaurant.repository';
import { asyncHandler } from '../shared/utils/async-handler';
import { BadRequestError } from '../shared/errors/app-error';
import { createPublicRateLimiter } from '../middlewares/rate-limit/public-rate-limiter.middleware';

const router = Router();
const bootstrapService = new PublicBootstrapService();
const orderService = new OrderService();
const paymentOrchestrator = new PaymentOrchestratorService();
const restaurantRepo = new RestaurantRepository();

// Rate limiters: bootstrap reads get 60 req/min, order creation gets 10 req/min
const bootstrapLimiter = createPublicRateLimiter(60, 60_000);
const orderLimiter = createPublicRateLimiter(10, 60_000);

/**
 * Phase 1: Single Bootstrap Endpoint
 * GET /api/v1/public/restaurants/:slug/bootstrap
 */
router.get(
  '/restaurants/:slug/bootstrap',
  bootstrapLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = String(req.params.slug || 'demo');
    const data = await bootstrapService.getBootstrapData(slug);
    res.json({
      success: true,
      version: '2.0.0',
      schemaVersion: 2,
      data,
    });
  })
);

/**
 * Phase 2: Public Order Creation Endpoint
 * POST /api/v1/public/orders
 * Reuses OrderService.checkoutOrder() and PaymentOrchestratorService without duplicating logic
 */
router.post(
  '/orders',
  orderLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // Frontend sends `orderMode`; backend OrderService uses `orderType`.
    const {
      restaurantSlug,
      customerPhone,       // Primary WhatsApp LID / Phone
      customerName,
      contactPhone,        // Preferred customer contact phone from checkout form
      customerContactPhone, // Alternative field name
      orderMode,   // frontend field name
      orderType,   // legacy field name (kept for backward compat)
      tableNumber,
      notes,       // customer cooking instructions
      instructions,
      items,
      paymentMethod,
    } = req.body;

    const resolvedNotes = notes || instructions || null;
    const resolvedContactPhone = contactPhone || customerContactPhone || null;

    const resolvedOrderType: 'takeaway' | 'dining' =
      (orderMode ?? orderType ?? 'takeaway') === 'dining' ? 'dining' : 'takeaway';

    if (!restaurantSlug || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('restaurantSlug, customerPhone, and non-empty items array are required');
    }

    // 1. Resolve Restaurant Tenant by Slug
    const restaurant = await restaurantRepo.findBySlugOrId(restaurantSlug);
    if (!restaurant) {
      throw new BadRequestError(`Restaurant '${restaurantSlug}' not found`);
    }

    const restaurantId = restaurant.id;

    // 2. Format Cart payload to match existing OrderService interface
    const cart = {
      items: items.map((item: any) => ({
        menuItemId: item.menuItemId,
        variantId: item.variantId || null,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        selectedModifiers: item.selectedModifiers || [],
      })),
    };

    // 3. Generate Idempotency Key
    const idempotencyKey = `web_order:${restaurantId}:${customerPhone}:${Date.now()}`;

    // 4. Create Order via existing OrderService (100% Logic Reuse)
    const { order, payment } = await orderService.checkoutOrder(
      restaurantId,
      customerPhone,
      cart,
      idempotencyKey,
      resolvedOrderType,
      tableNumber ? Number(tableNumber) : undefined,
      resolvedNotes,
      customerName ? customerName.trim() : null,
      resolvedContactPhone ? resolvedContactPhone.trim() : null
    );

    // 4b. Update customer profile in DB if name or contact phone provided by web checkout form.
    if ((customerName && customerName.trim()) || (resolvedContactPhone && resolvedContactPhone.trim())) {
      try {
        const { CustomerService } = require('../modules/customers/services/customer.service');
        const customerSvc = new CustomerService();
        const existingCustomer = await customerSvc.findByPhone(restaurantId, customerPhone);
        if (existingCustomer) {
          await customerSvc.updateCustomerProfile(existingCustomer.id, {
            name: customerName ? customerName.trim() : undefined,
            contactPhone: resolvedContactPhone ? resolvedContactPhone.trim() : undefined,
          });
        }
      } catch (nameUpdateErr) {
        // Non-fatal: log but don't fail the order placement
        const { logger } = require('../infrastructure/logger/logger');
        logger.warn({ nameUpdateErr, customerPhone }, 'Could not update customer profile from web checkout');
      }
    }
    // 5. Generate Payment Link if Razorpay or online provider selected
    let paymentLink: string | null = null;
    if (paymentMethod === 'razorpay' || paymentMethod === 'online') {
      try {
        const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
        const redirectUrl = `${dashboardUrl}/order/${restaurantSlug}?orderId=${order.id}&status=success`;
        const linkResult = await paymentOrchestrator.createOrRetryPaymentLink({
          orderId: order.id,
          restaurantId,
          customerPhone,
          amount: order.totalAmount,
          providerName: 'razorpay',
          callbackUrl: redirectUrl,
        });
        paymentLink = linkResult.paymentUrl || (linkResult as any).paymentLink || null;

        // Transition order from checkout_pending → payment_pending now that a payment link exists.
        // This makes the Razorpay webhook transition (payment_pending → paid) valid.
        try {
          await orderService.transitionOrder(order.id, 'payment_pending');
        } catch (transitionErr) {
          // Non-fatal: log but don't fail the order creation response
          const { logger } = require('../infrastructure/logger/logger');
          logger.warn({ transitionErr, orderId: order.id }, 'Could not transition order to payment_pending after link creation');
        }
      } catch (err) {
        // Fallback to manual UPI if gateway fails
        paymentLink = null;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        // Top-level orderId for easy access by frontend consumers
        orderId: order.id,
        order: {
          id: order.id,
          humanReadableId: order.humanReadableId,
          totalAmount: order.totalAmount,
          status: order.status,
          orderType: order.orderType,
          tableNumber: order.tableNumber,
          customerPhone,
          customerName: customerName ?? null,
        },
        payment: {
          id: payment?.id || null,
          status: payment?.status || 'pending',
          paymentLink,
        },
      },
    });
  })
);

/**
 * Phase 2: Public Order Status Polling / Receipt Endpoint
 * GET /api/v1/public/orders/:orderId/status
 */
router.get(
  '/orders/:orderId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId);

    const order = await orderService.getOrderById(orderId);

    // Fetch associated payment status to verify payment state
    let paymentStatus = 'pending';
    try {
      const payment = await paymentOrchestrator['paymentRepo'].getByOrderId(orderId);
      if (payment) {
        paymentStatus = payment.paymentStatus;
      }
    } catch (_) {}

    // If payment is verified/captured but order status hasn't transitioned yet, report 'paid'
    const effectiveStatus = (paymentStatus === 'verified' || paymentStatus === 'captured') && (order.status === 'checkout_pending' || order.status === 'payment_pending')
      ? 'paid'
      : order.status;

    res.json({
      success: true,
      data: {
        id: order.id,
        humanReadableId: order.humanReadableId,
        status: effectiveStatus,
        paymentStatus,
        totalAmount: order.totalAmount,
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        createdAt: order.createdAt,
      },
    });
  })
);

/**
 * Public Coupon Validation Endpoint
 * POST /api/v1/public/coupons/validate
 */
router.post(
  '/coupons/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const { restaurantSlug, code, orderSubtotal } = req.body;
    if (!restaurantSlug || !code) {
      throw new BadRequestError('restaurantSlug and code are required');
    }

    const restaurant = await restaurantRepo.findBySlugOrId(restaurantSlug);
    if (!restaurant) {
      throw new BadRequestError(`Restaurant '${restaurantSlug}' not found`);
    }

    const { couponService } = require('../modules/marketing/services/coupon.service');
    const result = await couponService.validateCoupon(
      restaurant.id,
      code,
      Number(orderSubtotal || 0)
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
