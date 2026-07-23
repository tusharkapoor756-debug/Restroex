import { db } from '../../../infrastructure/database/database.client';

export interface WhatsAppConfig {
  id?: string;
  restaurantId: string;
  orderingMode: 'ai_only' | 'interactive_only' | 'hybrid';
  homeScreenItems: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class WhatsAppConfigRepository {
  private get client() {
    return db.getClient();
  }

  public async getByRestaurantId(restaurantId: string): Promise<WhatsAppConfig> {
    const { data, error } = await this.client
      .from('restaurant_whatsapp_config')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch WhatsApp config: ${error.message}`);
    }

    if (!data) {
      // Return default configuration
      return {
        restaurantId,
        orderingMode: 'hybrid',
        homeScreenItems: ['browse_menu', 'best_sellers', 'offers', 'track_order', 'talk_to_staff'],
      };
    }

    const homeItems = data.home_screen_items && data.home_screen_items.length > 0
      ? data.home_screen_items
      : ['browse_menu', 'best_sellers', 'offers', 'track_order', 'talk_to_staff'];

    return {
      id: data.id,
      restaurantId: data.restaurant_id,
      orderingMode: data.ordering_mode as any,
      homeScreenItems: homeItems,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async upsert(config: Partial<WhatsAppConfig> & { restaurantId: string }): Promise<WhatsAppConfig> {
    const payload: Record<string, any> = {
      restaurant_id: config.restaurantId,
      updated_at: new Date().toISOString(),
    };

    if (config.orderingMode !== undefined) payload.ordering_mode = config.orderingMode;
    if (config.homeScreenItems !== undefined) payload.home_screen_items = config.homeScreenItems;

    const { data, error } = await this.client
      .from('restaurant_whatsapp_config')
      .upsert(payload, { onConflict: 'restaurant_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save WhatsApp config: ${error.message}`);
    }

    return {
      id: data.id,
      restaurantId: data.restaurant_id,
      orderingMode: data.ordering_mode as any,
      homeScreenItems: data.home_screen_items || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
