import { Tool, ToolContext } from '../types/tools.types';
import { ActionValidatorService } from '../services/action-validator.service';
import { ActionExecutorService } from '../services/action-executor.service';
import { SessionService } from '../../conversations/session.service';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { logger } from '../../../infrastructure/logger/logger';

interface UpdateCartQuantityArgs {
  menuItemId: string;
  quantity: number;
  variantId?: string;
}

export class UpdateCartQuantityTool implements Tool<UpdateCartQuantityArgs, any> {
  public readonly definition = {
    name: 'update_cart_quantity',
    description: 'Updates the quantity of an item in the customer\'s cart using menuItemId and absolute quantity.',
    parameters: {
      type: 'object' as const,
      properties: {
        menuItemId: { type: 'string', description: 'The unique ID of the menu item to update.' },
        quantity: { type: 'integer', description: 'The new absolute quantity requested.' },
        variantId: { type: 'string', description: 'Optional unique ID of the variant.' },
      },
      required: ['menuItemId', 'quantity'],
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

  public async execute(args: UpdateCartQuantityArgs, context: ToolContext): Promise<any> {
    const start = Date.now();
    let validatorTime = 0;
    let executorTime = 0;

    try {
      const { menuItemId, quantity, variantId } = args;

      const [session, menuItems] = await Promise.all([
        this.sessionService.getSession(context.restaurantId, context.customerPhone),
        this.menuRepository.listByRestaurantWithVariants(context.restaurantId),
      ]);

      const menuItem = menuItems.find((m) => m.id === menuItemId);
      if (!menuItem) {
        return { success: false, error: `Menu item with ID ${menuItemId} not found` };
      }

      // Check validation
      const action: any = {
        type: 'UPDATE_QUANTITY',
        item: menuItem.name,
        quantity: quantity,
        delta: false, // absolute quantity update
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
      };

      const execCtx = {
        restaurantId: context.restaurantId,
        customerPhone: context.customerPhone,
        availableMenu: menuItems,
      };

      const execStart = Date.now();
      const result = await (this.executor as any).executeUpdateQuantity(action, resolvedValidation, execCtx);
      executorTime = Date.now() - execStart;

      const success = result.status === 'SUCCESS';

      // Load updated session to compute totals
      const updatedSession = await this.sessionService.getSession(context.restaurantId, context.customerPhone);
      const items = updatedSession.cart.items;
      const cartTotal = items.reduce((sum: number, ci: any) => sum + (ci.quantity * ci.unitPrice), 0);

      const response = {
        success,
        quantity,
        cartTotal,
      };

      logger.info(
        {
          toolMutation: 'update_cart_quantity',
          validatorTime,
          executorTime,
          toolExecutionTime: Date.now() - start,
        },
        'Cart Mutation Tool Completed'
      );

      return response;
    } catch (error: any) {
      logger.error({ error }, 'update_cart_quantity tool failed');
      return { success: false, error: error.message || 'Execution error' };
    }
  }
}
