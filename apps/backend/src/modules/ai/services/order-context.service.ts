import { SessionRepository } from '../../conversations/repositories/session.repository';
import { SessionService } from '../../conversations/session.service';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { MenuRepository } from '../../menu/repositories/menu.repository';

export class OrderContextService {

    private readonly sessionService: SessionService;
    private readonly restaurantRepository: RestaurantRepository;
    private readonly menuRepository: MenuRepository;
    private readonly sessionRepository: SessionRepository;

    constructor() {
        this.sessionService = new SessionService();
        this.sessionRepository = new SessionRepository();
        this.restaurantRepository = new RestaurantRepository();
        this.menuRepository = new MenuRepository();
    }

    public async build(
        restaurantId: string,
        customerPhone: string,
        customerMessage: string,
    ): Promise<string> {

        // Restaurant
        const restaurant =
            await this.restaurantRepository.findById(
                restaurantId,
            );

        const restaurantName =
            restaurant?.name || 'Restaurant';

        // Session
        const session =
            await this.sessionRepository.findSession(
                restaurantId,
                customerPhone,
            );

        const cart =
            session?.cart;

        // Menu
        const menuItems =
            await this.menuRepository.listByRestaurant(
                restaurantId,
            );

        // ----------------------------
        // Build Menu
        // ----------------------------

        let menuText = 'No menu available.';

        if (menuItems.length > 0) {

            menuText = menuItems
                .filter(item => item.isAvailable)
                .map(
                    item =>
                        `${item.name} - ₹${item.basePrice}`,
                )
                .join('\n');

        }

        // ----------------------------
        // Build Cart
        // ----------------------------

        let cartText = 'Cart is empty.';
        let grandTotal = 0;

        if (cart && cart.items.length > 0) {

            const lines: string[] = [];

            for (const cartItem of cart.items) {

                const menuItem =
                    menuItems.find(
                        item => item.id === cartItem.menuItemId,
                    );

                const itemName =
                    menuItem?.name || 'Unknown Item';

                const lineTotal =
                    cartItem.quantity *
                    cartItem.unitPrice;

                grandTotal += lineTotal;

                lines.push(
                    `${cartItem.quantity} × ${itemName} = ₹${lineTotal}`,
                );

            }

            cartText =
                lines.join('\n') +
                `\n\nTotal: ₹${grandTotal}`;

        }

        // ----------------------------
        // Final AI Context
        // ----------------------------

        return `
Restaurant Name:
${restaurantName}

Available Menu:
${menuText}

Current Cart:
${cartText}

Customer Message:
${customerMessage}
`;

    }

}