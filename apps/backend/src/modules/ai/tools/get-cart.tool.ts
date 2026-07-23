import { Tool, ToolContext } from '../types/tools.types';
import { SessionRepository } from '../../conversations/repositories/session.repository';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { getDisplayName } from '../../../shared/utils/display-name.util';

export class GetCartTool implements Tool<void, any> {
  public readonly definition = {
    name: 'get_cart',
    description: 'Retrieves the current items in the customer cart with item names, variant names, quantities, and prices.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  private readonly sessionRepository: SessionRepository;
  private readonly menuRepository: MenuRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.menuRepository = new MenuRepository();
  }

  public async execute(args: void, context: ToolContext): Promise<any> {
    const [session, menuItems] = await Promise.all([
      this.sessionRepository.findSession(context.restaurantId, context.customerPhone),
      this.menuRepository.listByRestaurantWithVariants(context.restaurantId),
    ]);

    const items: any[] = [];
    const rawCart = session?.cart;

    if (rawCart?.items && rawCart.items.length > 0) {
      for (const cartItem of rawCart.items) {
        const itemName = getDisplayName(cartItem, menuItems);
        const variantName = cartItem.variantId
          ? menuItems
              .find((m: any) => m.id === cartItem.menuItemId)
              ?.variants?.find((v: any) => v.id === cartItem.variantId)?.variantName
          : undefined;

        items.push({
          menuItemId: cartItem.menuItemId,
          itemName,
          variantId: cartItem.variantId,
          variantName,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.unitPrice * cartItem.quantity,
        });
      }
    }

    return {
      items,
      totalItems: items.reduce((acc, item) => acc + item.quantity, 0),
      totalPrice: items.reduce((acc, item) => acc + item.totalPrice, 0),
    };
  }
}
