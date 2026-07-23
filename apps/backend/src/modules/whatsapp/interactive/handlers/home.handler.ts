import { InteractiveScreen } from '../interactive-action.types';
import { WhatsAppConfigRepository } from '../../../restaurants/repositories/whatsapp-config.repository';

export class InteractiveHomeHandler {
  private configRepo = new WhatsAppConfigRepository();

  public async render(restaurantId: string, restaurantName: string): Promise<InteractiveScreen> {
    const config = await this.configRepo.getByRestaurantId(restaurantId);
    
    const bodyLines = [
      `🙏 Namaste! Welcome to *${restaurantName}*.`,
      'Aapka swagat hai! Hum aapka order lene ke liye ready hain.',
      '',
      'Kripya neeche diye gaye menu options me se select karein ya type karke order karein.'
    ];

    const buttons: Array<{ id: string; title: string }> = [];
    const listRows: Array<{ id: string; title: string; description?: string }> = [];

    // Map configuration items to titles & payloads
    for (const item of config.homeScreenItems) {
      if (item === 'browse_menu') {
        listRows.push({
          id: JSON.stringify({ a: 'browse', p: 1 }),
          title: '🍽️ Browse Menu',
          description: 'Explore full menu dynamically',
        });
      } else if (item === 'best_sellers') {
        listRows.push({
          id: JSON.stringify({ a: 'best_sellers' }),
          title: '🔥 Best Sellers',
          description: 'Chef recommended & popular dishes',
        });
      } else if (item === 'offers') {
        listRows.push({
          id: JSON.stringify({ a: 'offers' }),
          title: '🎁 Today\'s Offers',
          description: 'Exciting discounts and deals',
        });
      } else if (item === 'track_order') {
        listRows.push({
          id: JSON.stringify({ a: 'track_order' }),
          title: '📦 Track Order',
          description: 'Check status of your active order',
        });
      } else if (item === 'talk_to_staff') {
        listRows.push({
          id: JSON.stringify({ a: 'talk_to_staff' }),
          title: '☎️ Talk to Staff',
          description: 'Connect with a restaurant agent',
        });
      }
    }

    // First 3 items as buttons for quick access, rest in list
    const buttonItems = listRows.slice(0, 3);
    const remainingItems = listRows.slice(3);

    for (const item of buttonItems) {
      buttons.push({
        id: item.id,
        title: item.title.split(' ').slice(1).join(' '), // Strip emoji for buttons
      });
    }

    let list: InteractiveScreen['list'] = undefined;
    if (remainingItems.length > 0) {
      list = {
        buttonTitle: 'More Options',
        sections: [
          {
            title: 'Menu Options',
            rows: remainingItems,
          },
        ],
      };
    }

    return {
      id: 'home',
      title: restaurantName,
      body: bodyLines.join('\n'),
      buttons,
      list,
    };
  }
}
