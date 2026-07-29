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
        // 1. Fetch current session & settings
        const session = await this.sessionService.getSession(restaurantId, customerPhone);
        const cart = session.cart;

        if (!cart || (cart.items?.length ?? 0) === 0) {
            return this.buildEmptyCartReply();
        }

        const settingsData = await this.settingsRepository.getSettings(restaurantId);
        const settings = settingsData.settings;

        // REVISION 4: Use snapshotted order modes / total tables from session context if available
        const supportedModes = session.context.snapshotSupportedOrderModes || settings.supportedOrderModes || ['takeaway', 'dining'];
        const totalTables = session.context.snapshotTotalTables || settings.totalTables || 25;

        // ── STEP A: Order Mode Resolution ─────────────────────────────────────
        let orderType: 'takeaway' | 'dining' | undefined = session.context.orderType;

        if (!orderType) {
            const hasTakeaway = supportedModes.includes('takeaway');
            const hasDining = supportedModes.includes('dining');

            if (hasTakeaway && !hasDining) {
                orderType = 'takeaway';
                await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
                    event: { name: 'SELECT_ORDER_MODE', payload: { orderType: 'takeaway' } }
                }));
            } else if (hasDining && !hasTakeaway) {
                orderType = 'dining';
                await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
                    event: { name: 'SELECT_ORDER_MODE', payload: { orderType: 'dining' } }
                }));
            } else {
                // CASE 3: Takeaway + Dining ➔ Ask Customer
                await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
                    event: { name: 'SELECT_ORDER_MODE' }
                }));
                return [
                    '🍽️ *How would you like your order?*',
                    '',
                    '1️⃣ *Dining* (Eat at restaurant)',
                    '2️⃣ *Takeaway* (Pickup)',
                    '',
                    'Please reply with *1* or *2*.'
                ].join('\n');
            }
        }

        // ── STEP B: Table Number Resolution (for Dining) ─────────────────────
        let tableNumber: number | undefined = session.context.tableNumber;

        if (orderType === 'dining' && tableNumber === undefined) {
            await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
                event: { name: 'PROVIDE_TABLE_NUMBER' }
            }));
            // REVISION 3: Explicit simplified instruction
            return `Please reply with only your table number (for example: 5 or 12).\n(Valid table numbers: 1 to ${totalTables})`;
        }

        const codEnabled = settings.codEnabled;

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

            logger.info({ idempotencyKey, orderType, tableNumber }, 'No existing order found. Initiating checkout.');
            const checkoutResult = await this.orderService.checkoutOrder(
                restaurantId,
                customerPhone,
                cart,
                idempotencyKey,
                orderType,
                tableNumber
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
        if (settings.onlinePaymentsEnabled && paymentContext.usablePaymentMethods.some((m: string) => ['razorpay', 'cashfree', 'phonepe', 'payu', 'easebuzz', 'stripe'].includes(m))) {
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

            const orderModeSummary = order.orderType === 'dining'
                ? `Mode\t\t: *🍽️ Dining (Table ${order.tableNumber || 'N/A'})*`
                : `Mode\t\t: *🥡 Takeaway*`;

            return [
                `🍽️ *Order Placed*`,
                `━━━━━━━━━━━━━━`,
                `Order ID\t\t: ${displayOrderId}`,
                `Amount\t\t: *₹${order.totalAmount}*`,
                orderModeSummary,
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

        const upiMerchantName = settings.upiMerchantName || 'Restaurant Merchant';
        const upiId = settings.upiId || '';
        const upiQrImageUrl = settings.upiQrImageUrl;

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