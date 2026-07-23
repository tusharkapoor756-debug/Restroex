import { Tool, ToolContext } from '../types/tools.types';
import { CheckoutHandler } from '../../whatsapp/handlers/checkout.handler';

export class CheckoutTool implements Tool<void, any> {
  public readonly definition = {
    name: 'checkout_cart',
    description: 'Initiates checkout for the current customer cart, generating an order and transitioning the state to checkout.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  private readonly checkoutHandler: CheckoutHandler;

  constructor() {
    this.checkoutHandler = new CheckoutHandler();
  }

  public async execute(args: void, context: ToolContext): Promise<any> {
    const resultText = await this.checkoutHandler.handle(context.restaurantId, context.customerPhone);
    return {
      success: true,
      message: resultText,
    };
  }
}
