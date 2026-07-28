import { Request, Response } from 'express';
import { WhatsAppConfigRepository } from '../../restaurants/repositories/whatsapp-config.repository';
import { whatsappProviderFactory } from '../providers/whatsapp-provider.factory';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { logger } from '../../../infrastructure/logger/logger';

export class RestroexManagedWhatsAppController {
  private readonly configRepo = new WhatsAppConfigRepository();
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || 'v19.0';
  private readonly graphBaseUrl = 'https://graph.facebook.com';

  /**
   * POST /api/v1/whatsapp/restroex-managed/register
   * Registers a phone number under Restroex's single WABA and requests an OTP from Meta.
   */
  public registerNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const restaurantId = this.getRestaurantId(req);
      const { whatsappNumber, codeMethod } = req.body;

      if (!whatsappNumber) {
        res.status(400).json({ success: false, error: 'WhatsApp phone number is required.' });
        return;
      }

      const systemToken = process.env.RESTROEX_WHATSAPP_SYSTEM_USER_TOKEN;
      const wabaId = process.env.RESTROEX_WHATSAPP_WABA_ID;

      if (!systemToken || !wabaId) {
        logger.error('Missing RESTROEX_WHATSAPP_SYSTEM_USER_TOKEN or RESTROEX_WHATSAPP_WABA_ID env variables');
        res.status(500).json({
          success: false,
          error: 'Restroex-Managed WhatsApp service is not configured on the server. Missing WABA credentials.',
        });
        return;
      }

      // Fetch restaurant profile for verified name
      const restaurant = await this.restaurantRepo.findById(restaurantId);
      const verifiedName = restaurant?.name || 'Restaurant Ordering Bot';

      // Parse phone number into country code (cc) and national number
      const parsed = this.parsePhoneNumber(whatsappNumber);

      // 1. Add phone number to Restroex's WABA
      const addNumberUrl = `${this.graphBaseUrl}/${this.apiVersion}/${wabaId}/phone_numbers`;
      let phoneNumberId: string | null = null;

      logger.info({ restaurantId, cc: parsed.cc, nationalNumber: parsed.nationalNumber }, 'Adding phone number to Restroex WABA');

      const addRes = await fetch(addNumberUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cc: parsed.cc,
          phone_number: parsed.nationalNumber,
          verified_name: verifiedName,
        }),
      });

      const addData: any = await addRes.json().catch(() => ({}));

      if (addRes.ok && addData.id) {
        phoneNumberId = addData.id;
      } else {
        // Handle case where phone number was already added under WABA
        const errorMsg = addData?.error?.message || '';
        logger.warn({ errorData: addData, status: addRes.status }, 'WABA phone_numbers endpoint returned non-200');

        if (addData?.error?.error_user_title || addData?.error?.message) {
          // If error indicates number is already attached or on another account
          if (errorMsg.includes('already exists') || errorMsg.includes('already registered')) {
            // Attempt to lookup existing phone_number_id under WABA
            phoneNumberId = await this.lookupPhoneNumberIdUnderWaba(wabaId, systemToken, parsed.fullNumber);
          }
        }

        if (!phoneNumberId) {
          res.status(400).json({
            success: false,
            error: addData?.error?.error_user_msg || errorMsg || 'Failed to add phone number to Meta Business Account.',
          });
          return;
        }
      }

      // 2. Request OTP Code from Meta
      const requestCodeUrl = `${this.graphBaseUrl}/${this.apiVersion}/${phoneNumberId}/request_code`;
      const codeRes = await fetch(requestCodeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code_method: codeMethod === 'VOICE' ? 'VOICE' : 'SMS',
          language: 'en_US',
        }),
      });

      const codeData: any = await codeRes.json().catch(() => ({}));

      if (!codeRes.ok) {
        const errDetail = codeData?.error?.error_user_msg || codeData?.error?.message || 'Failed to send OTP code via Meta.';
        logger.error({ codeData, phoneNumberId }, 'Meta request_code failed');
        await this.configRepo.upsert({
          restaurantId,
          cloudPhoneNumberId: phoneNumberId || undefined,
          billingMode: 'restroex_managed',
          numberVerificationStatus: 'failed',
        });

        res.status(400).json({ success: false, error: errDetail });
        return;
      }

      // 3. Save pending OTP state
      await this.configRepo.upsert({
        restaurantId,
        cloudPhoneNumberId: phoneNumberId || undefined,
        billingMode: 'restroex_managed',
        numberVerificationStatus: 'otp_sent',
      });

      res.status(200).json({
        success: true,
        data: {
          phoneNumberId,
          status: 'otp_sent',
          message: `OTP sent successfully via ${codeMethod === 'VOICE' ? 'Voice Call' : 'SMS'} to +${parsed.fullNumber}`,
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'RestroexManagedWhatsAppController.registerNumber error');
      res.status(500).json({ success: false, error: err?.message || 'Internal error during number registration.' });
    }
  };

  /**
   * POST /api/v1/whatsapp/restroex-managed/verify
   * Confirms the OTP with Meta and activates Restroex-Managed Cloud API provider.
   */
  public verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const restaurantId = this.getRestaurantId(req);
      const { otp } = req.body;

      if (!otp) {
        res.status(400).json({ success: false, error: 'OTP code is required.' });
        return;
      }

      const systemToken = process.env.RESTROEX_WHATSAPP_SYSTEM_USER_TOKEN;
      if (!systemToken) {
        res.status(500).json({ success: false, error: 'Restroex System Token not configured on server.' });
        return;
      }

      const config = await this.configRepo.getByRestaurantId(restaurantId);
      if (!config.cloudPhoneNumberId) {
        res.status(400).json({ success: false, error: 'No phone number registration found for this restaurant. Please click Send OTP first.' });
        return;
      }

      const verifyUrl = `${this.graphBaseUrl}/${this.apiVersion}/${config.cloudPhoneNumberId}/verify_code`;
      const verifyRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: String(otp).trim() }),
      });

      const verifyData: any = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok) {
        const errorMsg = verifyData?.error?.error_user_msg || verifyData?.error?.message || 'Invalid or expired OTP code.';
        logger.warn({ verifyData, restaurantId }, 'Meta verify_code failed');

        await this.configRepo.upsert({
          restaurantId,
          numberVerificationStatus: 'failed',
        });

        res.status(400).json({ success: false, error: errorMsg });
        return;
      }

      // OTP Verification Success! Activate Restroex-Managed Cloud API Provider
      const updatedConfig = await this.configRepo.upsert({
        restaurantId,
        providerType: 'cloud_api',
        billingMode: 'restroex_managed',
        numberVerificationStatus: 'verified',
      });

      // Invalidate Redis cache & connect session
      await whatsappProviderFactory.invalidateCache(restaurantId);
      const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
      const sessionStatus = await provider.connectSession(restaurantId);

      res.status(200).json({
        success: true,
        data: {
          config: updatedConfig,
          sessionStatus,
          message: 'WhatsApp number verified successfully! Restroex-Managed Bot is now live.',
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'RestroexManagedWhatsAppController.verifyOtp error');
      res.status(500).json({ success: false, error: err?.message || 'Internal error during OTP verification.' });
    }
  };

  /**
   * POST /api/v1/whatsapp/restroex-managed/disconnect
   * Deregisters the restaurant's phone number from Meta Cloud API and resets local configuration.
   */
  public disconnectNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const restaurantId = this.getRestaurantId(req);
      const config = await this.configRepo.getByRestaurantId(restaurantId);

      if (config.billingMode !== 'restroex_managed' || !config.cloudPhoneNumberId) {
        res.status(400).json({
          success: false,
          error: 'No active Restroex-Managed WhatsApp number found to disconnect.',
        });
        return;
      }

      const systemToken = process.env.RESTROEX_WHATSAPP_SYSTEM_USER_TOKEN;
      if (!systemToken) {
        res.status(500).json({ success: false, error: 'Restroex System Token not configured on server.' });
        return;
      }

      // Call Meta Graph API deregister endpoint
      const deregisterUrl = `${this.graphBaseUrl}/${this.apiVersion}/${config.cloudPhoneNumberId}/deregister`;
      logger.info({ restaurantId, cloudPhoneNumberId: config.cloudPhoneNumberId }, 'Calling Meta deregister endpoint');

      const metaRes = await fetch(deregisterUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${systemToken}`,
          'Content-Type': 'application/json',
        },
      });

      const metaData: any = await metaRes.json().catch(() => ({}));

      if (!metaRes.ok) {
        const errorMsg = metaData?.error?.error_user_msg || metaData?.error?.message || 'Meta deregistration API call failed.';
        logger.error({ metaData, restaurantId }, 'Meta phone number deregistration failed');
        // Do NOT reset local DB row if Meta API call fails
        res.status(400).json({ success: false, error: errorMsg });
        return;
      }

      // Meta Deregistration Succeeded! Reset local DB config row
      const resetConfig = await this.configRepo.upsert({
        restaurantId,
        cloudPhoneNumberId: '',
        billingMode: 'self_managed',
        numberVerificationStatus: 'pending',
        providerType: 'webjs',
      });

      // Invalidate Redis provider cache & disconnect provider session
      await whatsappProviderFactory.invalidateCache(restaurantId);
      const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
      await provider.disconnectSession(restaurantId);

      res.status(200).json({
        success: true,
        data: {
          config: resetConfig,
          message: 'Restroex-Managed WhatsApp number deregistered successfully.',
        },
      });
    } catch (err: any) {
      logger.error({ err }, 'RestroexManagedWhatsAppController.disconnectNumber error');
      res.status(500).json({ success: false, error: err?.message || 'Internal error during number deregistration.' });
    }
  };

  private parsePhoneNumber(phone: string): { cc: string; nationalNumber: string; fullNumber: string } {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return { cc: '91', nationalNumber: cleaned.slice(2), fullNumber: cleaned };
    }
    if (cleaned.length === 10) {
      return { cc: '91', nationalNumber: cleaned, fullNumber: '91' + cleaned };
    }
    // Default fallback: split first 2 digits as cc
    const cc = cleaned.length > 10 ? cleaned.slice(0, cleaned.length - 10) : '91';
    const nationalNumber = cleaned.slice(cleaned.length - 10);
    return { cc, nationalNumber, fullNumber: cc + nationalNumber };
  }

  private async lookupPhoneNumberIdUnderWaba(wabaId: string, token: string, fullPhone: string): Promise<string | null> {
    try {
      const url = `${this.graphBaseUrl}/${this.apiVersion}/${wabaId}/phone_numbers`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const match = (data.data || []).find((item: any) => {
        const display = (item.display_phone_number || '').replace(/\D/g, '');
        return display.endsWith(fullPhone) || fullPhone.endsWith(display);
      });
      return match ? match.id : null;
    } catch {
      return null;
    }
  }

  private getRestaurantId(req: Request): string {
    return String((req as any).restaurantId || '');
  }
}
