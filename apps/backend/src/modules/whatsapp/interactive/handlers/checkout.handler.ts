import { InteractiveScreen } from '../interactive-action.types';
import { CheckoutHandler } from '../../handlers/checkout.handler';

export class InteractiveCheckoutHandler {
  private get checkoutHandler(): any {
    const { CheckoutHandler } = require('../../handlers/checkout.handler');
    return new CheckoutHandler();
  }

  public async execute(restaurantId: string, customerPhone: string): Promise<InteractiveScreen> {
    const textResult = await this.checkoutHandler.handle(restaurantId, customerPhone);
    
    return {
      id: 'checkout_success',
      title: 'Order Placed',
      body: textResult || '✅ Order placed successfully! We have received your order details.',
      buttons: [
        { id: JSON.stringify({ a: 'cancel_order' }), title: '❌ Cancel Order' },
        { id: JSON.stringify({ a: 'home' }), title: '🏠 Back to Home' },
      ],
    };
  }
}
