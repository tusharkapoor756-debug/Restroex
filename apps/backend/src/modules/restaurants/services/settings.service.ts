import { BadRequestError } from '../../../shared/errors/app-error';
import { SettingsRepository } from '../repositories/settings.repository';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { FullSettings, BusinessProfile, RestaurantSettings } from '../types/settings.types';

export class SettingsService {
  private readonly repository: SettingsRepository;

  constructor() {
    this.repository = new SettingsRepository();
  }

  public async getSettings(restaurantId: string): Promise<FullSettings> {
    if (!restaurantId) {
      throw new BadRequestError('Restaurant ID is required');
    }
    return this.repository.getSettings(restaurantId);
  }

  public async updateSettings(restaurantId: string, dto: UpdateSettingsDto): Promise<FullSettings> {
    if (!restaurantId) {
      throw new BadRequestError('Restaurant ID is required');
    }

    const { profile, settings } = this.validateAndNormalizeDto(dto);

    return this.repository.updateSettings(restaurantId, profile, settings);
  }

  private validateAndNormalizeDto(dto: UpdateSettingsDto): {
    profile: Partial<BusinessProfile>;
    settings: Partial<Omit<RestaurantSettings, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>>;
  } {
    const profile: Partial<BusinessProfile> = {};
    const settings: Partial<Omit<RestaurantSettings, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>> = {};

    // ─── Business Profile Validation ─────────────────────────────────────────
    if (dto.logoUrl !== undefined) {
      profile.logoUrl = dto.logoUrl ? String(dto.logoUrl).trim() : undefined;
    }

    if (dto.name !== undefined) {
      const name = String(dto.name || '').trim();
      if (name.length < 2 || name.length > 120) {
        throw new BadRequestError('Restaurant name must be between 2 and 120 characters');
      }
      profile.name = name;
    }

    if (dto.ownerName !== undefined) {
      profile.ownerName = dto.ownerName ? String(dto.ownerName).trim() : undefined;
    }

    if (dto.phoneNumber !== undefined) {
      const phone = String(dto.phoneNumber || '').replace(/[^\d+]/g, '').trim();
      const digitCount = phone.replace(/[^\d]/g, '').length;
      if (digitCount < 8 || digitCount > 15) {
        throw new BadRequestError('Phone must contain 8 to 15 digits');
      }
      profile.phoneNumber = phone;
    }

    if (dto.email !== undefined) {
      if (dto.email) {
        const email = String(dto.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new BadRequestError('Valid email is required');
        }
        profile.email = email;
      } else {
        profile.email = undefined;
      }
    }

    if (dto.address !== undefined) {
      profile.address = dto.address ? String(dto.address).trim() : undefined;
    }

    if (dto.city !== undefined) {
      profile.city = dto.city ? String(dto.city).trim() : undefined;
    }

    if (dto.state !== undefined) {
      profile.state = dto.state ? String(dto.state).trim() : undefined;
    }

    if (dto.pincode !== undefined) {
      if (dto.pincode) {
        const pincode = String(dto.pincode).replace(/[^\d]/g, '').trim();
        if (pincode.length < 4 || pincode.length > 10) {
          throw new BadRequestError('Pincode must contain 4 to 10 digits');
        }
        profile.pincode = pincode;
      } else {
        profile.pincode = undefined;
      }
    }

    // ─── Tax & Billing Validation ─────────────────────────────────────────────
    if (dto.gstEnabled !== undefined) {
      settings.gstEnabled = !!dto.gstEnabled;
    }

    // Check GST number rule: if enabled, we need a GST number
    const activeGstEnabled = dto.gstEnabled !== undefined ? dto.gstEnabled : undefined;

    if (dto.gstNumber !== undefined) {
      settings.gstNumber = dto.gstNumber ? String(dto.gstNumber).trim() : undefined;
    }

    if (dto.gstPercentage !== undefined) {
      const pct = Number(dto.gstPercentage);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        throw new BadRequestError('GST percentage must be a number between 0 and 100');
      }
      settings.gstPercentage = pct;
    }

    if (dto.fssaiNumber !== undefined) {
      settings.fssaiNumber = dto.fssaiNumber ? String(dto.fssaiNumber).trim() : undefined;
    }

    // If GST is enabled, enforce GST number field
    if (activeGstEnabled || (dto.gstEnabled === undefined && settings.gstEnabled)) {
      const gstNum = dto.gstNumber !== undefined ? dto.gstNumber : undefined;
      if (dto.gstEnabled && !gstNum && !settings.gstNumber) {
        throw new BadRequestError('GST number is required when GST is enabled');
      }
    }

    // ─── Payment Settings Validation ─────────────────────────────────────────
    if (dto.paymentMethods !== undefined) {
      if (!Array.isArray(dto.paymentMethods)) {
        throw new BadRequestError('paymentMethods must be an array of strings');
      }
      const validModes = ['manual_upi']; // Razorpay, PhonePe, Stripe will be added here in future
      const methods = dto.paymentMethods.map(m => String(m).trim().toLowerCase());
      for (const mode of methods) {
        if (!validModes.includes(mode)) {
          throw new BadRequestError(`Unsupported payment mode. Supported modes: ${validModes.join(', ')}`);
        }
      }
      settings.paymentMethods = methods;
    }

    if (dto.upiMerchantName !== undefined) {
      settings.upiMerchantName = dto.upiMerchantName ? String(dto.upiMerchantName).trim() : undefined;
    }

    if (dto.upiId !== undefined) {
      const upi = dto.upiId ? String(dto.upiId).trim() : undefined;
      if (upi && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi)) {
        throw new BadRequestError('Invalid UPI ID format (e.g. name@bank)');
      }
      settings.upiId = upi;
    }

    if (dto.upiQrImageUrl !== undefined) {
      settings.upiQrImageUrl = dto.upiQrImageUrl ? String(dto.upiQrImageUrl).trim() : undefined;
    }

    // ─── Store Settings Validation ───────────────────────────────────────────
    if (dto.pickupAvailable !== undefined) {
      settings.pickupAvailable = !!dto.pickupAvailable;
    }

    if (dto.prepTime !== undefined) {
      const time = Math.round(Number(dto.prepTime));
      if (isNaN(time) || time < 0) {
        throw new BadRequestError('Estimated preparation time must be a non-negative integer');
      }
      settings.prepTime = time;
    }

    if (dto.pickupInstructions !== undefined) {
      settings.pickupInstructions = dto.pickupInstructions ? String(dto.pickupInstructions).trim() : undefined;
    }

    // ─── New Settings Validation ─────────────────────────────────────────────
    if (dto.invoicePrefix !== undefined) {
      settings.invoicePrefix = dto.invoicePrefix ? String(dto.invoicePrefix).trim() : undefined;
    }

    if (dto.receiptFooter !== undefined) {
      settings.receiptFooter = dto.receiptFooter ? String(dto.receiptFooter).trim() : undefined;
    }

    if (dto.supportPhone !== undefined) {
      settings.supportPhone = dto.supportPhone ? String(dto.supportPhone).trim() : undefined;
    }

    if (dto.supportEmail !== undefined) {
      if (dto.supportEmail) {
        const email = String(dto.supportEmail).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new BadRequestError('Valid support email is required');
        }
        settings.supportEmail = email;
      } else {
        settings.supportEmail = undefined;
      }
    }

    if (dto.website !== undefined) {
      settings.website = dto.website ? String(dto.website).trim() : undefined;
    }

    if (dto.instagram !== undefined) {
      settings.instagram = dto.instagram ? String(dto.instagram).trim() : undefined;
    }

    if (dto.invoiceNotes !== undefined) {
      settings.invoiceNotes = dto.invoiceNotes ? String(dto.invoiceNotes).trim() : undefined;
    }

    if (dto.termsAndConditions !== undefined) {
      settings.termsAndConditions = dto.termsAndConditions ? String(dto.termsAndConditions).trim() : undefined;
    }

    if (dto.autoAcceptPaidOrders !== undefined) {
      settings.autoAcceptPaidOrders = !!dto.autoAcceptPaidOrders;
    }

    if (dto.codEnabled !== undefined) {
      settings.codEnabled = !!dto.codEnabled;
    }

    if (dto.manualUpiEnabled !== undefined) {
      settings.manualUpiEnabled = !!dto.manualUpiEnabled;
    }

    if (dto.onlinePaymentsEnabled !== undefined) {
      settings.onlinePaymentsEnabled = !!dto.onlinePaymentsEnabled;
    }

    return { profile, settings };
  }
}
