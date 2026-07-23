import { Tool, ToolContext } from '../types/tools.types';
import { ActionValidatorService } from '../services/action-validator.service';
import { ActionExecutorService } from '../services/action-executor.service';
import { SessionService } from '../../conversations/session.service';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { logger } from '../../../infrastructure/logger/logger';

export class ClearCartTool implements Tool<void, any> {
  public readonly definition = {
    name: 'clear_cart',
    description: 'Clears the customer\'s cart entirely, emptying all items and resetting state.',
    parameters: {
      type: 'object' as const,
      properties: {},
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

  public async execute(args: void, context: ToolContext): Promise<any> {
    const start = Date.now();
    let validatorTime = 0;
    let executorTime = 0;

    try {
      const [session, menuItems] = await Promise.all([
        this.sessionService.getSession(context.restaurantId, context.customerPhone),
        this.menuRepository.listByRestaurantWithVariants(context.restaurantId),
      ]);

      const action: any = {
        type: 'CLEAR_CART',
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

      const execCtx = {
        restaurantId: context.restaurantId,
        customerPhone: context.customerPhone,
        availableMenu: menuItems,
      };

      const execStart = Date.now();
      const result = await (this.executor as any).executeClearCart(execCtx);
      executorTime = Date.now() - execStart;

      const success = result.status === 'SUCCESS';

      const response = {
        success,
        cartTotal: 0,
        items: [],
      };

      logger.info(
        {
          toolMutation: 'clear_cart',
          validatorTime,
          executorTime,
          toolExecutionTime: Date.now() - start,
        },
        'Cart Mutation Tool Completed'
      );

      return response;
    } catch (error: any) {
      logger.error({ error }, 'clear_cart tool failed');
      return { success: false, error: error.message || 'Execution error' };
    }
  }
}
