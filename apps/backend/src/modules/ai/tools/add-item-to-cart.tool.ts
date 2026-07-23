import { Tool, ToolContext } from '../types/tools.types';
import { ActionValidatorService } from '../services/action-validator.service';
import { ActionExecutorService } from '../services/action-executor.service';
import { SessionService } from '../../conversations/session.service';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { logger } from '../../../infrastructure/logger/logger';
import { getDisplayName } from '../../../shared/utils/display-name.util';

interface AddItemToCartArgs {
  menuItemId: string;
  quantity: number;
  variantId?: string;
  customization?: string;
}

export class AddItemToCartTool implements Tool<AddItemToCartArgs, any> {
  public readonly definition = {
    name: 'add_item_to_cart',
    description: 'Adds an item to the customer\'s cart using menuItemId, quantity, optional variantId, and optional customization. Leverages validation and execution pipelines.',
    parameters: {
      type: 'object' as const,
      properties: {
        menuItemId: { type: 'string', description: 'The unique ID of the menu item to add.' },
        quantity: { type: 'integer', description: 'Quantity of the item to add.' },
        variantId: { type: 'string', description: 'Optional unique ID of the variant.' },
        customization: { type: 'string', description: 'Optional customization notes.' },
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

  public async execute(args: AddItemToCartArgs, context: ToolContext): Promise<any> {
    const start = Date.now();
    let validatorTime = 0;
    let executorTime = 0;

    try {
      const { menuItemId, quantity, variantId, customization } = args;

      const [session, menuItems] = await Promise.all([
        this.sessionService.getSession(context.restaurantId, context.customerPhone),
        this.menuRepository.listByRestaurantWithVariants(context.restaurantId),
      ]);

      const menuItem = menuItems.find((m) => m.id === menuItemId);
      if (!menuItem) {
        return { success: false, error: `Menu item with ID ${menuItemId} not found` };
      }

      // Check variant if applicable
      const variant = variantId
        ? menuItem.variants.find((v: any) => v.id === variantId)
        : undefined;

      // Construct ExecutionAction representation
      const action: any = {
        type: 'ADD_ITEM',
        item: menuItem.name,
        variant: variant?.variantName,
        quantity: quantity,
        customization,
      };

      // Construct ValidationContext
      const validationCtx = {
        menu: menuItems,
        cartItems: session.cart.items,
        conversationState: session.state,
        hasPendingPayment: false, // Default context
        hasActiveOrder: false,    // Default context
      };

      const valStart = Date.now();
      const valResult = this.validator.validate(action, validationCtx);
      validatorTime = Date.now() - valStart;

      if (!valResult.valid) {
        return { success: false, error: valResult.reason || 'Validation failed' };
      }

      // Pass resolved entities to bypass duplicate matching
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
      // Invoke executor method directly
      const result = await (this.executor as any).executeAddItem(action, resolvedValidation, execCtx);
      executorTime = Date.now() - execStart;

      const success = result.status === 'SUCCESS';

      // Load updated session to compute totals
      const updatedSession = await this.sessionService.getSession(context.restaurantId, context.customerPhone);
      const items = updatedSession.cart.items;
      const cartTotal = items.reduce((sum: number, ci: any) => sum + (ci.quantity * ci.unitPrice), 0);

      const displayName = getDisplayName(
        { itemName: menuItem.name, variantName: variant?.variantName, variantId },
        menuItems
      );

      const unitPrice = variant?.price ?? menuItem.basePrice ?? 0;

      const response = {
        success,
        displayName,
        quantity,
        unitPrice,
        subtotal: quantity * unitPrice,
        cartTotal,
      };

      logger.info(
        {
          toolMutation: 'add_item_to_cart',
          validatorTime,
          executorTime,
          toolExecutionTime: Date.now() - start,
        },
        'Cart Mutation Tool Completed'
      );

      return response;
    } catch (error: any) {
      logger.error({ error }, 'add_item_to_cart tool failed');
      return { success: false, error: error.message || 'Execution error' };
    }
  }
}
