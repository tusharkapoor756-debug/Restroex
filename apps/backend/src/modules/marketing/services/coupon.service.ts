import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';
import { BadRequestError } from '../../../shared/errors/app-error';

export interface CouponRecord {
  id: string;
  restaurantId: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
  activeDays?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponDto {
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
  activeDays?: string[];
}

export class CouponService {
  private get client() {
    return db.getClient();
  }

  /**
   * List all coupons for a restaurant.
   */
  public async getCoupons(restaurantId: string): Promise<CouponRecord[]> {
    const { data: rows, error } = await this.client
      .from('coupons')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error, restaurantId }, 'Failed to fetch coupons');
      return [];
    }

    return (rows || []).map(this.mapToDomain);
  }

  /**
   * Create a new coupon for a restaurant.
   */
  public async createCoupon(restaurantId: string, dto: CreateCouponDto): Promise<CouponRecord> {
    const code = String(dto.code || '').trim().toUpperCase();
    if (!code || code.length < 3) {
      throw new BadRequestError('Coupon code must be at least 3 characters long');
    }

    const discountValue = Number(dto.discountValue);
    if (isNaN(discountValue) || discountValue <= 0) {
      throw new BadRequestError('Discount value must be a positive number');
    }

    if (dto.discountType === 'percentage' && discountValue > 100) {
      throw new BadRequestError('Percentage discount cannot exceed 100%');
    }

    const parseExpiryDate = (val: any): string | null => {
      if (!val) return null;
      try {
        const strVal = String(val).trim();
        if (!strVal) return null;
        // Clean out any malformed prefix such as '+02' or invalid leading offset chars
        const cleanedStr = strVal.replace(/^(\+\d{2})+/, '');
        const parsedDate = new Date(cleanedStr);
        if (isNaN(parsedDate.getTime())) return null;
        return parsedDate.toISOString();
      } catch {
        return null;
      }
    };

    const { data: created, error } = await this.client
      .from('coupons')
      .insert({
        restaurant_id: restaurantId,
        code,
        discount_type: dto.discountType === 'flat' ? 'flat' : 'percentage',
        discount_value: discountValue,
        min_order_amount: Number(dto.minOrderAmount || 0),
        max_discount_amount: dto.maxDiscountAmount ? Number(dto.maxDiscountAmount) : null,
        is_active: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        starts_at: parseExpiryDate(dto.startsAt),
        expires_at: parseExpiryDate(dto.expiresAt),
        active_days: Array.isArray(dto.activeDays) ? dto.activeDays : null,
      })
      .select('*')
      .single();

    if (error) {
      if (/unique_restaurant_coupon_code/i.test(error.message)) {
        throw new BadRequestError(`Coupon code '${code}' already exists for this restaurant`);
      }
      throw new Error(`Failed to create coupon: ${error.message}`);
    }

    return this.mapToDomain(created);
  }

  /**
   * Update or toggle coupon active state.
   */
  public async updateCoupon(restaurantId: string, couponId: string, updates: Partial<CreateCouponDto>): Promise<CouponRecord> {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updates.isActive !== undefined) payload.is_active = Boolean(updates.isActive);
    if (updates.discountValue !== undefined) payload.discount_value = Number(updates.discountValue);
    if (updates.minOrderAmount !== undefined) payload.min_order_amount = Number(updates.minOrderAmount);
    if (updates.maxDiscountAmount !== undefined) payload.max_discount_amount = Number(updates.maxDiscountAmount);
    if (updates.activeDays !== undefined) payload.active_days = Array.isArray(updates.activeDays) ? updates.activeDays : null;
    if (updates.startsAt !== undefined) {
      if (!updates.startsAt) {
        payload.starts_at = null;
      } else {
        const cleanedStr = String(updates.startsAt).trim().replace(/^(\+\d{2})+/, '');
        const parsedDate = new Date(cleanedStr);
        payload.starts_at = isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
      }
    }
    if (updates.expiresAt !== undefined) {
      if (!updates.expiresAt) {
        payload.expires_at = null;
      } else {
        const cleanedStr = String(updates.expiresAt).trim().replace(/^(\+\d{2})+/, '');
        const parsedDate = new Date(cleanedStr);
        payload.expires_at = isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
      }
    }

    const { data: updated, error } = await this.client
      .from('coupons')
      .update(payload)
      .eq('id', couponId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update coupon: ${error.message}`);
    }

    return this.mapToDomain(updated);
  }

  /**
   * Delete a coupon.
   */
  public async deleteCoupon(restaurantId: string, couponId: string): Promise<void> {
    const { error } = await this.client
      .from('coupons')
      .delete()
      .eq('id', couponId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Failed to delete coupon: ${error.message}`);
    }
  }

  /**
   * Public Validation Endpoint: Validates coupon during customer web checkout.
   */
  public async validateCoupon(
    restaurantId: string,
    code: string,
    orderSubtotal: number
  ): Promise<{ valid: boolean; coupon?: CouponRecord; discountAmount: number; message: string }> {
    const cleanCode = String(code || '').trim().toUpperCase();

    const { data: couponRow, error } = await this.client
      .from('coupons')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('code', cleanCode)
      .maybeSingle();

    if (error || !couponRow) {
      return { valid: false, discountAmount: 0, message: `Invalid coupon code '${cleanCode}'` };
    }

    const coupon = this.mapToDomain(couponRow);
    const now = new Date();
    const nowMs = now.getTime();

    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, message: `Coupon '${cleanCode}' is currently inactive` };
    }

    // 1. Starts At Check (Auto-Activation Date & Time)
    if (coupon.startsAt) {
      const startTime = new Date(coupon.startsAt).getTime();
      if (!isNaN(startTime) && startTime > nowMs) {
        return { valid: false, discountAmount: 0, message: `Coupon '${cleanCode}' is scheduled to start later` };
      }
    }

    // 2. Expires At Check (Auto-Expiry Date & Time)
    if (coupon.expiresAt) {
      const expDate = new Date(coupon.expiresAt);
      const expTime = (expDate.getUTCHours() === 0 && expDate.getUTCMinutes() === 0 && expDate.getUTCSeconds() === 0)
        ? expDate.getTime() + (24 * 60 * 60 * 1000 - 1)
        : expDate.getTime();

      if (expTime < nowMs) {
        return { valid: false, discountAmount: 0, message: `Coupon '${cleanCode}' has expired` };
      }
    }

    // 3. Recurring Active Days Check (e.g. Every Sunday)
    if (coupon.activeDays && Array.isArray(coupon.activeDays) && coupon.activeDays.length > 0) {
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayName = daysOfWeek[now.getDay()] || 'sunday';
      const normalizedDays = coupon.activeDays.map((d) => String(d).toLowerCase().trim());
      if (!normalizedDays.includes(currentDayName)) {
        return { valid: false, discountAmount: 0, message: `Coupon '${cleanCode}' is not active today (${currentDayName})` };
      }
    }

    if (orderSubtotal < coupon.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for coupon '${cleanCode}'`,
      };
    }

    // Calculate Discount Amount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (orderSubtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = Math.min(orderSubtotal, coupon.discountValue);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      coupon,
      discountAmount,
      message: `Coupon '${cleanCode}' applied successfully! Savings: ₹${discountAmount}`,
    };
  }

  private mapToDomain(row: any): CouponRecord {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      code: row.code,
      discountType: row.discount_type,
      discountValue: Number(row.discount_value || 0),
      minOrderAmount: Number(row.min_order_amount || 0),
      maxDiscountAmount: row.max_discount_amount ? Number(row.max_discount_amount) : undefined,
      isActive: Boolean(row.is_active),
      startsAt: row.starts_at || undefined,
      expiresAt: row.expires_at || undefined,
      activeDays: Array.isArray(row.active_days) ? row.active_days : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const couponService = new CouponService();
