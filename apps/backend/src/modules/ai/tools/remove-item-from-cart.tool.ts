import { Tool, ToolContext } from '../types/tools.types';
import { ActionValidatorService } from '../services/action-validator.service';
import { ActionExecutorService } from '../services/action-executor.service';
import { SessionService } from '../../conversations/session.service';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { logger } from '../../../infrastructure/logger/logger';
import { getDisplayName } from '../../../shared/utils/display-name.util';

interface RemoveItemFromCartArgs {
  menuItemId: string;
  variantId?: string;
}

export class RemoveItemFromCartTool implements Tool<RemoveItemFromCartArgs, any> {
  public readonly definition = {
    name: 'remove_item_from_cart',
    description: 'Removes an item from the customer\'s cart using menuItemId and optional variantId.',
    parameters: {
      type: 'object' as const,
      properties: {
        menuItemId: { type: 'string', description: 'The unique ID of the menu item to remove.' },
        variantId: { type: 'string', description: 'Optional unique ID of the variant.' },
      },
      required: ['menuItemId'],
    },
  };

  private readonly validator: ActionValidatorService;
  private readonly executor: ActionExecutorService;
  private readonly sessionService: SessionService;
  private readonly menuRepository: MenuRepository;

  constructor() {
    this.validator = new ActionValidatorService();
    this.executor = new ActionExecutorService();
    this.sessionService = new SessionService();
    this.menuRepository = new MenuRepository();
  }

  public async execute(args: RemoveItemFromCartArgs, context: ToolContext): Promise<any> {
    const start = Date.now();
    let validatorTime = 0;
    let executorTime = 0;

    try {
      const { menuItemId, variantId } = args;

      const [session, menuItems] = await Promise.all([
        this.sessionService.getSession(context.restaurantId, context.customerPhone),
        this.menuRepository.listByRestaurantWithVariants(context.restaurantId),
      ]);

      const menuItem = menuItems.find((m) => m.id === menuItemId);
      if (!menuItem) {
        return { success: false, error: `Menu item with ID ${menuItemId} not found` };
      }

      const variant = variantId
        ? menuItem.variants.find((v: any) => v.id === variantId)
        : undefined;

      const action: any = {
        type: 'REMOVE_ITEM',
        item: menuItem.name,
        variant: variant?.variantName,
      };

      const validationCtx = {
        menu: menuItems,
        cartItems: session.cart.items,
        conversationState: session.state,
        hasPendingPayment: false,
        hasActiveOrder: false,
      };

      const valStart = Date.now();
      const valResult = this.validator.validate(action, validationCtx);
      validatorTime = Date.now() - valStart;

      if (!valResult.valid) {
        return { success: false, error: valResult.reason || 'Validation failed' };
      }

      const resolvedValidation = {
        resolvedMenuItem: menuItem,
        resolvedVariant: variant,
      };

      const execCtx = {
        restaurantId: context.restaurantId,
        customerPhone: context.customerPhone,
        availableMenu: menuItems,
      };

      const execStart = Date.now();
      const result = await (this.executor as any).executeRemoveItem(action, resolvedValidation, execCtx);
      executorTime = Date.now() - execStart;

      const success = result.status === 'SUCCESS';

      // Load updated session to compute totals
      const updatedSession = await this.sessionService.getSession(context.restaurantId, context.customerPhone);
      const items = updatedSession.cart.items;
      const cartTotal = items.reduce((sum: number, ci: any) => sum + (ci.quantity * ci.unitPrice), 0);

      const itemsSummary = items.map((ci: any) => {
        const dName = getDisplayName(ci, menuItems);
        return {
          menuItemId: ci.menuItemId,
          variantId: ci.variantId,
          displayName: dName,
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          subtotal: ci.quantity * ci.unitPrice,
        };
      });

      const response = {
        success,
        cartTotal,
        items: itemsSummary,
      };

      logger.info(
        {
          toolMutation: 'remove_item_from_cart',
          validatorTime,
          executorTime,
          toolExecutionTime: Date.now() - start,
        },
        'Cart Mutation Tool Completed'
      );

      return response;
    } catch (error: any) {
      logger.error({ error }, 'remove_item_from_cart tool failed');
      return { success: false, error: error.message || 'Execution error' };
    }
  }
}
