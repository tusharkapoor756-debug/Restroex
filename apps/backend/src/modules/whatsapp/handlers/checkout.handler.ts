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
            logger.info({ existingOrderId }, 'Found existing checkout order in session context. Reusing.');
            const paymentService = new (require('../../payments/services/payment.service').PaymentService)();
            order = await this.orderService['repository'].findById(existingOrderId);
            if (order) {
                payment = await paymentService.getPaymentByOrder(existingOrderId).catch(() => null);
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

        // 4. COD flow — order confirmed immediately, no payment collection required
        const paymentService = new (require('../../payments/services/payment.service').PaymentService)();

        if (codEnabled) {
            logger.info({ orderId: order.id }, 'COD enabled. Auto-transitioning order to accepted (COD).');

            // Ensure payment record exists for COD
            if (!payment) {
                logger.info({ orderId: order.id }, 'Creating cash payment record for COD order.');
                payment = await paymentService.createPayment({
                    orderId: order.id,
                    restaurantId,
                    customerPhone,
                    amount: order.totalAmount,
                    paymentMethod: 'cash',
                    providerName: 'cash',
                });
            }

            // Transition Order to accepted since payment is bypassed at checkout but order is confirmed
            if (order.status === 'checkout_pending' || order.status === 'payment_pending') {
                await this.orderService.transitionOrder(order.id, 'accepted');
            }

            // Reset conversation state
            await this.sessionService.executeSessionAction(
                restaurantId,
                customerPhone,
                async () => ({
                    event: { name: 'RESET' },
                }),
            );

            return this.buildCodCheckoutReply(order.humanReadableId || order.id);
        }

        // 5. Prepaid Manual UPI flow — ensure payment record exists and is in pending state
        if (!payment) {
            logger.info({ orderId: order.id }, 'No payment record found. Creating manual_upi payment record.');
            payment = await paymentService.createPayment({
                orderId: order.id,
                restaurantId,
                customerPhone,
                amount: order.totalAmount,
                paymentMethod: 'manual_upi',
                providerName: 'manual_upi',
            });
        }

        // Transition order to payment_pending if still checkout_pending
        if (order.status === 'checkout_pending') {
            await this.orderService.transitionOrder(order.id, 'payment_pending');
        }

        // Transition session state to awaiting_payment_screenshot
        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async () => ({
                event: { name: 'AWAIT_PAYMENT_SCREENSHOT' },
            }),
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