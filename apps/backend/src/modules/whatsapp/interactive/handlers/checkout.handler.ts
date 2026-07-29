import { InteractiveScreen } from '../interactive-action.types';
import { CheckoutHandler } from '../../handlers/checkout.handler';

export class InteractiveCheckoutHandler {
  private get checkoutHandler(): any {
    const { CheckoutHandler } = require('../../handlers/checkout.handler');
    return new CheckoutHandler();
  }

  public async execute(restaurantId: string, customerPhone: string): Promise<InteractiveScreen> {
    const textResult = await this.checkoutHandler.handle(restaurantId, customerPhone);
    const { SessionService } = require('../../../conversations/session.service');
    const { ConversationState } = require('../../../conversations/conversation.states');
    const sessionService = new SessionService();
    const session = await sessionService.getSession(restaurantId, customerPhone);

    // If checkoutHandler returned prompt for Order Mode
    if (session.state === ConversationState.AWAITING_ORDER_MODE || textResult.includes('How would you like your order?') || !session.context?.orderType) {
      const supportedModes: string[] = session.context?.snapshotSupportedOrderModes || ['dining', 'takeaway'];
      const modeEmojiMap: Record<string, string> = {
        dining: '🍽️ Dining',
        takeaway: '🥡 Takeaway',
        delivery: '🚚 Delivery',
      };

      const modeButtons = supportedModes.map(mode => ({
        id: JSON.stringify({ a: 'select_mode', mode }),
        title: modeEmojiMap[mode] || mode.toUpperCase(),
      }));

      return {
        id: 'order_mode_selection',
        title: 'Select Order Mode',
        body: textResult,
        buttons: modeButtons.length > 0 ? modeButtons : [
          { id: JSON.stringify({ a: 'select_mode', mode: 'dining' }), title: '🍽️ Dining' },
          { id: JSON.stringify({ a: 'select_mode', mode: 'takeaway' }), title: '🥡 Takeaway' },
        ],
      };
    }

    // If checkoutHandler returned prompt for Table Number
    if (session.state === ConversationState.AWAITING_TABLE_NUMBER || textResult.includes('table number')) {
      return {
        id: 'table_number_prompt',
        title: 'Enter Table Number',
        body: textResult,
        buttons: [
          { id: JSON.stringify({ a: 'home' }), title: '🏠 Back to Home' },
        ],
      };
    }

    // Completed / Payment Pending order placement
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
