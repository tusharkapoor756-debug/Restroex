import { OrderService } from '../../orders/services/order.service';
import { SessionService } from '../../conversations/session.service';
import { SettingsRepository } from '../../restaurants/repositories/settings.repository';
import { WhatsAppMessageService } from '../message.service';
import { logger } from '../../../infrastructure/logger/logger';

export class CheckoutHandler {
    private readonly orderService = new OrderService();
    private readonly sessionService = new SessionService();
    private readonly settingsRepository = new SettingsRepository();
    private readonly messages = new WhatsAppMessageService();

    public async handle(
        restaurantId: string,
        customerPhone: string,
    ): Promise<string> {
        try {
            return await this.executeCheckout(restaurantId, customerPhone);
        } catch (err: any) {
            logger.error({ err, message: err?.message, stack: err?.stack, restaurantId, customerPhone }, '❌ CheckoutHandler execution CRASHED');
            throw err;
        }
    }

    private async executeCheckout(
        restaurantId: string,
        customerPhone: string,
    ): Promise<string> {
        // 1. Fetch current session
        const session = await this.sessionService.getSession(restaurantId, customerPhone);
        const cart = session.cart;

        if (!cart || (cart.items?.length ?? 0) === 0) {
            return this.buildEmptyCartReply();
        }

        // 2. Fetch Restaurant Settings to determine payment method configuration
        const settings = await this.settingsRepository.getSettings(restaurantId);
        const codEnabled = settings.settings.codEnabled;

        // 3. Idempotent checkout — use existing order if already started
        let order: any = null;
        let payment: any = null;

        const existingOrderId = session.context.checkoutOrderId;
        if (existingOrderId) {
            const paymentService = new (require('../../payments/services/payment.service').PaymentService)();
            order = await this.orderService['repository'].findById(existingOrderId);
            if (order && (order.status === 'checkout_pending' || order.status === 'payment_pending')) {
                logger.info({ existingOrderId, status: order.status }, 'Found active order in session context. Reusing for payment completion.');
                payment = await paymentService.getPaymentByOrder(existingOrderId).catch(() => null);
            } else {
                logger.info({ existingOrderId, status: order?.status }, 'Existing order is terminal. Creating fresh order.');
                order = null;
            }
        }

        if (!order) {
            // Generate a stable idempotency key from cart fingerprint
            const cartFingerprint = cart.items
                .map(i => `${i.menuItemId}:${i.variantId || 'base'}:${i.quantity}`)
                .join('|');
            const idempotencyKey = `checkout:${restaurantId}:${customerPhone}:${cartFingerprint}`;

            logger.info({ idempotencyKey }, 'No existing order found. Initiating checkout.');
            const checkoutResult = await this.orderService.checkoutOrder(
                restaurantId,
                customerPhone,
                cart,
                idempotencyKey,
            );
            order = checkoutResult.order;
            payment = checkoutResult.payment;

            // Store orderId in session to prevent duplicate checkouts
            await this.sessionService.executeSessionAction(
                restaurantId,
                customerPhone,
                async () => ({
                    event: {
                        name: 'PROCEED_TO_CHECKOUT',
                        payload: { checkoutOrderId: order.id }
                    }
                })
            );
        }

        // 4. Resolve payment context dynamically from settings
        const paymentService = new (require('../../payments/services/payment.service').PaymentService)();
        const paymentContext = await paymentService.resolvePaymentContext(restaurantId);
        const resolvedMethod = paymentContext.resolvedPaymentMethod || paymentContext.usablePaymentMethods[0] || 'manual_upi';

        // A. If Automated Online Gateway is active (e.g. razorpay, cashfree, phonepe)
        if (settings.settings.onlinePaymentsEnabled && paymentContext.usablePaymentMethods.some((m: string) => ['razorpay', 'cashfree', 'phonepe', 'payu', 'easebuzz', 'stripe'].includes(m))) {
            const activeProvider = paymentContext.usablePaymentMethods.find((m: string) => ['razorpay', 'cashfree', 'phonepe', 'payu', 'easebuzz', 'stripe'].includes(m)) || 'razorpay';
            logger.info({ orderId: order.id, activeProvider }, '🚀 Online Payment Gateway active. Generating payment link.');

            const { PaymentOrchestratorService } = require('../../payments/services/payment-orchestrator.service');
            const orchestrator = new PaymentOrchestratorService();
            const linkResult = await orchestrator.createOrRetryPaymentLink({
                orderId: order.id,
                restaurantId,
                customerPhone,
                amount: order.totalAmount,
                providerName: activeProvider,
            });

            if (order.status === 'checkout_pending') {
                await this.orderService.transitionOrder(order.id, 'payment_pending');
            }

            const displayOrderId = order.humanReadableId 
                ? (order.humanReadableId.startsWith('#') ? order.humanReadableId : `#${order.humanReadableId}`)
                : `#ORD-${order.id.slice(0, 4).toUpperCase()}`;

            return [
                `🍽️ *Order Placed*`,
                `━━━━━━━━━━━━━━`,
                `Order ID\t\t: ${displayOrderId}`,
                `Amount\t\t: *₹${order.totalAmount}*`,
                `━━━━━━━━━━━━━━`,
                `💳 *Pay Online*`,
                `Tap the link below to pay securely via UPI, Card, or NetBanking.`,
                `👉 ${linkResult.paymentUrl}`,
                ``,
                `_Your order will be confirmed automatically once payment is completed._`,
            ].join('\n');
        }

        // B. COD flow — order confirmed immediately
        if (codEnabled && resolvedMethod === 'cash') {
            logger.info({ orderId: order.id }, 'COD enabled. Auto-transitioning order to accepted (COD).');

            if (!payment) {
                payment = await paymentService.createPayment({
                    orderId: order.id,
                    restaurantId,
                    customerPhone,
                    amount: order.totalAmount,
                    paymentMethod: 'cash',
                    providerName: 'cash',
                });
            }

            if (order.status === 'checkout_pending' || order.status === 'payment_pending') {
                await this.orderService.transitionOrder(order.id, 'accepted');
            }

            await this.sessionService.executeSessionAction(
                restaurantId,
                customerPhone,
                async () => ({ event: { name: 'RESET' } }),
            );

            return this.buildCodCheckoutReply(order.humanReadableId || order.id);
        }

        // C. Prepaid Manual UPI flow — generate QR & request screenshot
        if (!payment) {
            logger.info({ orderId: order.id }, 'Creating manual_upi payment record.');
            payment = await paymentService.createPayment({
                orderId: order.id,
                restaurantId,
                customerPhone,
                amount: order.totalAmount,
                paymentMethod: 'manual_upi',
                providerName: 'manual_upi',
            });
        }

        if (order.status === 'checkout_pending') {
            await this.orderService.transitionOrder(order.id, 'payment_pending');
        }

        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async () => ({ event: { name: 'AWAIT_PAYMENT_SCREENSHOT' } }),
        );

        const upiMerchantName = settings.settings.upiMerchantName || 'Restaurant Merchant';
        const upiId = settings.settings.upiId || '';
        const upiQrImageUrl = settings.settings.upiQrImageUrl;

        const reply = this.buildManualUpiReply(order.humanReadableId || order.id, order.totalAmount, {
            upiId,
            merchantName: upiMerchantName,
        });

        if (upiQrImageUrl) {
            // Fire QR image send asynchronously; don't block response
            this.messages.sendImage(restaurantId, customerPhone, upiQrImageUrl, reply).catch(err => {
                logger.error({ err }, 'Failed to send payment QR image');
            });
            return '';
        }

        return reply;
    }

    private buildCodCheckoutReply(orderId: string): string {
        return [
            '✅ *Order Confirmed (Cash on Delivery)!*',
            '',
            `🧾 Order Reference: *${orderId}*`,
            '',
            'Thank you for ordering with us ❤️',
            'We will notify you once the kitchen accepts your order.'
        ].join('\n');
    }

    private buildManualUpiReply(
        orderId: string,
        amount: number,
        paymentContext: { upiId: string; merchantName: string },
    ): string {
        return [
            '✅ *Order Registered Successfully!*',
            '',
            `🧾 Order Reference: *${orderId}*`,
            '',
            'Please complete payment to confirm your order:',
            '',
            `💵 *Amount:* ₹${amount}`,
            `🏛️ *UPI ID:* ${paymentContext.upiId || 'Not Configured'}`,
            `👤 *Merchant:* ${paymentContext.merchantName || 'Not Configured'}`,
            '',
            '👉 Scan the QR code or send money to the UPI ID above.',
            '',
            '📸 *Important:* After paying, send a screenshot of the receipt here so we can verify your payment.'
        ].join('\n');
    }

    private buildEmptyCartReply(): string {
        return [
            '🛒 Your cart is empty.',
            '',
            'Please add some items before checkout.',
        ].join('\n');
    }
}