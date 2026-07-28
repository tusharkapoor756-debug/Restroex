import { db } from '../../../infrastructure/database/database.client';

export type WhatsAppProviderType = 'webjs' | 'cloud_api';
export type WhatsAppBillingMode = 'self_managed' | 'restroex_managed';
export type NumberVerificationStatus = 'pending' | 'otp_sent' | 'verified' | 'failed';

export interface WhatsAppConfig {
  id?: string;
  restaurantId: string;
  orderingMode: 'ai_only' | 'interactive_only' | 'hybrid';
  homeScreenItems: string[];
  providerType: WhatsAppProviderType;
  billingMode?: WhatsAppBillingMode;
  numberVerificationStatus?: NumberVerificationStatus;
  cloudPhoneNumberId?: string;
  cloudAccessToken?: string;
  cloudWabaId?: string;
  webhookVerifyToken?: string;
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
      // Return default configuration (defaults to 'webjs' for 100% backward compatibility)
      return {
        restaurantId,
        orderingMode: 'hybrid',
        homeScreenItems: ['browse_menu', 'best_sellers', 'offers', 'track_order', 'talk_to_staff'],
        providerType: 'webjs',
        billingMode: 'self_managed',
        numberVerificationStatus: 'pending',
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
      providerType: (data.provider_type as WhatsAppProviderType) || 'webjs',
      billingMode: (data.billing_mode as WhatsAppBillingMode) || 'self_managed',
      numberVerificationStatus: (data.number_verification_status as NumberVerificationStatus) || 'pending',
      cloudPhoneNumberId: data.cloud_phone_number_id || undefined,
      cloudAccessToken: data.cloud_access_token || undefined,
      cloudWabaId: data.cloud_waba_id || undefined,
      webhookVerifyToken: data.webhook_verify_token || undefined,
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
    if (config.providerType !== undefined) payload.provider_type = config.providerType;
    if (config.billingMode !== undefined) payload.billing_mode = config.billingMode;
    if (config.numberVerificationStatus !== undefined) payload.number_verification_status = config.numberVerificationStatus;
    if (config.cloudPhoneNumberId !== undefined) payload.cloud_phone_number_id = config.cloudPhoneNumberId;
    if (config.cloudAccessToken !== undefined) payload.cloud_access_token = config.cloudAccessToken;
    if (config.cloudWabaId !== undefined) payload.cloud_waba_id = config.cloudWabaId;
    if (config.webhookVerifyToken !== undefined) payload.webhook_verify_token = config.webhookVerifyToken;

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
      providerType: (data.provider_type as WhatsAppProviderType) || 'webjs',
      billingMode: (data.billing_mode as WhatsAppBillingMode) || 'self_managed',
      numberVerificationStatus: (data.number_verification_status as NumberVerificationStatus) || 'pending',
      cloudPhoneNumberId: data.cloud_phone_number_id || undefined,
      cloudAccessToken: data.cloud_access_token || undefined,
      cloudWabaId: data.cloud_waba_id || undefined,
      webhookVerifyToken: data.webhook_verify_token || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
