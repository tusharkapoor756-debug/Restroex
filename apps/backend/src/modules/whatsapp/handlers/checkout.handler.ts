import { OrderService } from '../../orders/services/order.service';
import { SessionService } from '../../conversations/session.service';

export class CheckoutHandler {

    private readonly orderService: OrderService;
    private readonly sessionService: SessionService;

    constructor() {
        this.orderService = new OrderService();
        this.sessionService = new SessionService();
    }

    public async handle(
        restaurantId: string,
        customerPhone: string,
    ): Promise<string> {

        const cart =
            await this.sessionService.executeSessionAction(
                restaurantId,
                customerPhone,
                async () => ({
                    event: {
                        name: 'PROCEED_TO_CHECKOUT',
                    },
                    callback: async (updatedSession) =>
                        updatedSession.cart,
                }),
            );

        if (
            !cart ||
            (cart.items?.length ?? 0) === 0
        ) {
            return this.buildEmptyCartReply();
        }

        const idempotencyKey =
            `${restaurantId}-${customerPhone}-${Date.now()}`;

        const order =
            await this.orderService.checkoutOrder(
                restaurantId,
                customerPhone,
                cart,
                idempotencyKey,
            );

        await this.sessionService.executeSessionAction(
            restaurantId,
            customerPhone,
            async () => ({
                event: {
                    name: 'RESET',
                },
            }),
        );

        return this.buildCheckoutReply(order.id);

    }

    private buildCheckoutReply(
        orderId: string,
    ): string {

        return [
            '✅ Order placed successfully!',
            '',
            `🧾 Order ID: ${orderId}`,
            '',
            'Thank you for ordering with us ❤️',
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