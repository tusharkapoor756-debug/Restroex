import { db } from '../../../infrastructure/database/database.client';
import { FullSettings, RestaurantSettings, BusinessProfile } from '../types/settings.types';
import { logger } from '../../../infrastructure/logger/logger';

export class SettingsRepository {
  private get client() {
    return db.getClient();
  }

  /**
   * Fetches full settings (profile + restaurant-specific settings) for a restaurant.
   * If the settings row does not exist, it inserts default settings.
   */
  public async getSettings(restaurantId: string): Promise<FullSettings> {
    // 1. Fetch restaurant profile
    const { data: profileRow, error: profileError } = await this.client
      .from('restaurants')
      .select('logo_url, name, owner_name, phone_number, phone, email, address, city, state, pincode')
      .eq('id', restaurantId)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Failed to fetch restaurant profile: ${profileError.message}`);
    }

    if (!profileRow) {
      throw new Error(`Restaurant ${restaurantId} not found`);
    }

    // 2. Fetch restaurant settings. If not present, create it with defaults.
    let { data: settingsRow, error: settingsError } = await this.client
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Failed to fetch restaurant settings: ${settingsError.message}`);
    }

    if (!settingsRow) {
      logger.info({ restaurantId }, 'Settings row missing. Creating default restaurant settings.');
      const { data: newRow, error: insertError } = await this.client
        .from('restaurant_settings')
        .insert({
          restaurant_id: restaurantId,
          gst_enabled: false,
          gst_number: null,
          gst_percentage: 0.00,
          fssai_number: null,
          payment_methods: ['manual_upi'],
          upi_merchant_name: null,
          upi_id: null,
          upi_qr_image_url: null,
          pickup_available: true,
          prep_time: 15,
          pickup_instructions: null,
          invoice_prefix: null,
          receipt_footer: null,
          support_phone: null,
          support_email: null,
          website: null,
          instagram: null,
          invoice_notes: null,
          terms_and_conditions: null,
          auto_accept_paid_orders: false,
          cod_enabled: false,
          manual_upi_enabled: true
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create default settings: ${insertError.message}`);
      }
      settingsRow = newRow;
    }

    return this.mapToDomain(profileRow, settingsRow);
  }

  /**
   * Updates/upserts both profile and settings for a restaurant.
   */
  public async updateSettings(
    restaurantId: string,
    profileUpdate: Partial<BusinessProfile>,
    settingsUpdate: Partial<Omit<RestaurantSettings, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<FullSettings> {
    
    // 1. Update restaurant profile if anything is provided
    if (Object.keys(profileUpdate).length > 0) {
      const profilePayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (profileUpdate.logoUrl !== undefined) profilePayload.logo_url = profileUpdate.logoUrl;
      if (profileUpdate.name !== undefined) profilePayload.name = profileUpdate.name;
      if (profileUpdate.ownerName !== undefined) profilePayload.owner_name = profileUpdate.ownerName;
      if (profileUpdate.phoneNumber !== undefined) {
        profilePayload.phone_number = profileUpdate.phoneNumber;
        profilePayload.phone = profileUpdate.phoneNumber;
      }
      if (profileUpdate.email !== undefined) profilePayload.email = profileUpdate.email;
      if (profileUpdate.address !== undefined) profilePayload.address = profileUpdate.address;
      if (profileUpdate.city !== undefined) profilePayload.city = profileUpdate.city;
      if (profileUpdate.state !== undefined) profilePayload.state = profileUpdate.state;
      if (profileUpdate.pincode !== undefined) profilePayload.pincode = profileUpdate.pincode;

      const { error: profileError } = await this.client
        .from('restaurants')
        .update(profilePayload)
        .eq('id', restaurantId);

      if (profileError) {
        // Fallback for phone vs phone_number
        if (/phone_number/i.test(profileError.message) && /column|schema cache|does not exist/i.test(profileError.message)) {
          delete profilePayload.phone_number;
          const fallback = await this.client
            .from('restaurants')
            .update(profilePayload)
            .eq('id', restaurantId);
          if (fallback.error) {
            throw new Error(`Failed to update restaurant profile: ${fallback.error.message}`);
          }
        } else {
          throw new Error(`Failed to update restaurant profile: ${profileError.message}`);
        }
      }
    }

    // 2. Update settings (using upsert/insert with restaurant_id constraint check)
    if (Object.keys(settingsUpdate).length > 0) {
      const settingsPayload: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (settingsUpdate.gstEnabled !== undefined) settingsPayload.gst_enabled = settingsUpdate.gstEnabled;
      if (settingsUpdate.gstNumber !== undefined) settingsPayload.gst_number = settingsUpdate.gstNumber;
      if (settingsUpdate.gstPercentage !== undefined) settingsPayload.gst_percentage = settingsUpdate.gstPercentage;
      if (settingsUpdate.fssaiNumber !== undefined) settingsPayload.fssai_number = settingsUpdate.fssaiNumber;
      if (settingsUpdate.paymentMethods !== undefined) settingsPayload.payment_methods = settingsUpdate.paymentMethods;
      if (settingsUpdate.upiMerchantName !== undefined) settingsPayload.upi_merchant_name = settingsUpdate.upiMerchantName;
      if (settingsUpdate.upiId !== undefined) settingsPayload.upi_id = settingsUpdate.upiId;
      if (settingsUpdate.upiQrImageUrl !== undefined) settingsPayload.upi_qr_image_url = settingsUpdate.upiQrImageUrl;
      if (settingsUpdate.pickupAvailable !== undefined) settingsPayload.pickup_available = settingsUpdate.pickupAvailable;
      if (settingsUpdate.prepTime !== undefined) settingsPayload.prep_time = settingsUpdate.prepTime;
      if (settingsUpdate.pickupInstructions !== undefined) settingsPayload.pickup_instructions = settingsUpdate.pickupInstructions;

      if (settingsUpdate.invoicePrefix !== undefined) settingsPayload.invoice_prefix = settingsUpdate.invoicePrefix;
      if (settingsUpdate.receiptFooter !== undefined) settingsPayload.receipt_footer = settingsUpdate.receiptFooter;
      if (settingsUpdate.supportPhone !== undefined) settingsPayload.support_phone = settingsUpdate.supportPhone;
      if (settingsUpdate.supportEmail !== undefined) settingsPayload.support_email = settingsUpdate.supportEmail;
      if (settingsUpdate.website !== undefined) settingsPayload.website = settingsUpdate.website;
      if (settingsUpdate.instagram !== undefined) settingsPayload.instagram = settingsUpdate.instagram;
      if (settingsUpdate.invoiceNotes !== undefined) settingsPayload.invoice_notes = settingsUpdate.invoiceNotes;
      if (settingsUpdate.termsAndConditions !== undefined) settingsPayload.terms_and_conditions = settingsUpdate.termsAndConditions;
      if (settingsUpdate.autoAcceptPaidOrders !== undefined) settingsPayload.auto_accept_paid_orders = settingsUpdate.autoAcceptPaidOrders;
      if (settingsUpdate.codEnabled !== undefined) settingsPayload.cod_enabled = settingsUpdate.codEnabled;
      if (settingsUpdate.manualUpiEnabled !== undefined) settingsPayload.manual_upi_enabled = settingsUpdate.manualUpiEnabled;

      const { error: settingsError } = await this.client
        .from('restaurant_settings')
        .upsert({
          restaurant_id: restaurantId,
          ...settingsPayload
        }, {
          onConflict: 'restaurant_id'
        });

      if (settingsError) {
        throw new Error(`Failed to update restaurant settings: ${settingsError.message}`);
      }
    }

    return this.getSettings(restaurantId);
  }

  private mapToDomain(profileRow: any, settingsRow: any): FullSettings {
    return {
      profile: {
        logoUrl: profileRow.logo_url || undefined,
        name: profileRow.name || '',
        ownerName: profileRow.owner_name || undefined,
        phoneNumber: profileRow.phone_number || profileRow.phone || '',
        email: profileRow.email || undefined,
        address: profileRow.address || undefined,
        city: profileRow.city || undefined,
        state: profileRow.state || undefined,
        pincode: profileRow.pincode || undefined,
      },
      settings: {
        id: settingsRow.id,
        restaurantId: settingsRow.restaurant_id,
        gstEnabled: settingsRow.gst_enabled ?? false,
        gstNumber: settingsRow.gst_number || undefined,
        gstPercentage: settingsRow.gst_percentage !== undefined ? Number(settingsRow.gst_percentage) : 0,
        fssaiNumber: settingsRow.fssai_number || undefined,
        paymentMethods: settingsRow.payment_methods || ['manual_upi'],
        upiMerchantName: settingsRow.upi_merchant_name || undefined,
        upiId: settingsRow.upi_id || undefined,
        upiQrImageUrl: settingsRow.upi_qr_image_url || undefined,
        pickupAvailable: settingsRow.pickup_available ?? true,
        prepTime: settingsRow.prep_time !== undefined ? Number(settingsRow.prep_time) : 15,
        pickupInstructions: settingsRow.pickup_instructions || undefined,
        invoicePrefix: settingsRow.invoice_prefix || undefined,
        receiptFooter: settingsRow.receipt_footer || undefined,
        supportPhone: settingsRow.support_phone || undefined,
        supportEmail: settingsRow.support_email || undefined,
        website: settingsRow.website || undefined,
        instagram: settingsRow.instagram || undefined,
        invoiceNotes: settingsRow.invoice_notes || undefined,
        termsAndConditions: settingsRow.terms_and_conditions || undefined,
        autoAcceptPaidOrders: settingsRow.auto_accept_paid_orders ?? false,
        codEnabled: settingsRow.cod_enabled ?? false,
        manualUpiEnabled: settingsRow.manual_upi_enabled ?? true,
        createdAt: settingsRow.created_at,
        updatedAt: settingsRow.updated_at,
      }
    };
  }
}
