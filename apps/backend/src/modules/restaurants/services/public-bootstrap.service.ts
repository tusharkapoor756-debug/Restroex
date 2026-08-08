import { RestaurantRepository } from '../repositories/restaurant.repository';
import { SettingsService } from './settings.service';
import { MenuService } from '../../menu/services/menu.service';
import { NotFoundError } from '../../../shared/errors/app-error';
import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';

export class PublicBootstrapService {
  private readonly restaurantRepo = new RestaurantRepository();
  private readonly settingsService = new SettingsService();
  private readonly menuService = new MenuService();

  public async getBootstrapData(slugOrId: string) {
    // 1. Resolve Restaurant Tenant
    const restaurant = await this.restaurantRepo.findBySlugOrId(slugOrId);
    if (!restaurant) {
      throw new NotFoundError(`Restaurant '${slugOrId}' not found`);
    }

    const restaurantId = restaurant.id;

    // 2. Resolve Operational Settings & Capabilities via existing SettingsService.
    // FullSettings = { profile: BusinessProfile, settings: RestaurantSettings }
    const fullSettings = await this.settingsService.getSettings(restaurantId);
    const { profile, settings } = fullSettings;

    // 3. Resolve Menu Catalog via existing MenuService.
    // listMenuWithVariants() includes variants and customization groups — required for ordering.
    const categories = await this.menuService.listCategories(restaurantId);
    const menuItemsWithVariants = await this.menuService.listMenuWithVariants(restaurantId);

    // Combine categories with their items, variants, and modifier groups
    const enrichedCategories = categories.map((cat: any) => {
      const catItems = menuItemsWithVariants.filter((item: any) => item.categoryId === cat.id);
      return {
        id: cat.id,
        name: cat.name,
        sortOrder: cat.displayOrder || 0,
        items: catItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || null,
          price: Number(item.basePrice) || 0,
          imageUrl: item.imageUrl || null,
          isAvailable: item.isAvailable ?? true,
          isVeg: item.vegType === 'veg',
          isSpicy: false, // not a DB field — future: add spicy flag to schema
          isBestSeller: item.isPopular ?? false,
          allowInstructions: item.allowInstructions ?? true,
          variants: (item.variants || []).map((v: any) => ({
            id: v.id,
            name: v.variantName || v.name,
            price: Number(v.price),
          })),
          modifierGroups: (item.customizations || []).reduce((groups: any[], c: any) => {
            // customizations are flat rows; group by groupName
            const existing = groups.find((g: any) => g.name === c.groupName);
            const opt = { id: c.id, name: c.name, price: Number(c.additionalPrice) || 0 };
            if (existing) {
              existing.options.push(opt);
            } else {
              groups.push({
                id: c.groupName || c.id,
                name: c.groupName || 'Add-ons',
                minSelection: 0,
                maxSelection: c.maxSelectable || 1,
                options: [opt],
              });
            }
            return groups;
          }, []),
        })),
      };
    });

    // 4. Resolve Active Payment Methods strictly from DB Restaurant Settings.
    let usablePaymentMethods: string[] = [];
    if (settings.paymentMethods && Array.isArray(settings.paymentMethods) && settings.paymentMethods.length > 0) {
      usablePaymentMethods = [...settings.paymentMethods];
    } else {
      if (settings.onlinePaymentsEnabled) usablePaymentMethods.push('razorpay');
      if (settings.manualUpiEnabled) usablePaymentMethods.push('upi');
      if (settings.codEnabled) usablePaymentMethods.push('cash');
      if (usablePaymentMethods.length === 0) usablePaymentMethods = ['cash'];
    }

    // 5. Resolve Active Coupons for public customer display
    let activeCoupons: any[] = [];
    try {
      const { data: activeCouponsRows, error: couponErr } = await db.getClient()
        .from('coupons')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (couponErr) {
        logger.error({ error: couponErr, restaurantId }, '⚠️ [BOOTSTRAP] Failed to fetch active coupons');
      }

      const now = new Date();
      const nowMs = now.getTime();
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayName = daysOfWeek[now.getDay()];

      activeCoupons = (activeCouponsRows || []).filter((c: any) => {
        // 1. Starts At Check (Auto-Activation Date & Time)
        if (c.starts_at) {
          const startTime = new Date(c.starts_at).getTime();
          if (!isNaN(startTime) && startTime > nowMs) return false;
        }

        // 2. Expires At Check (Auto-Expiry Date & Time)
        if (c.expires_at) {
          const expDate = new Date(c.expires_at);
          const expTime = (expDate.getUTCHours() === 0 && expDate.getUTCMinutes() === 0)
            ? expDate.getTime() + 86399999
            : expDate.getTime();
          if (expTime < nowMs) return false;
        }

        // 3. Recurring Active Days Check (e.g. Every Sunday)
        if (c.active_days && Array.isArray(c.active_days) && c.active_days.length > 0) {
          const normalizedDays = c.active_days.map((d: any) => String(d).toLowerCase().trim());
          if (!normalizedDays.includes(currentDayName)) return false;
        }

        return true;
      }).map((c: any) => ({
        id: c.id,
        code: c.code,
        discountType: c.discount_type === 'flat' ? 'fixed' : c.discount_type,
        discountValue: Number(c.discount_value),
        minOrderAmount: Number(c.min_order_amount || 0),
        maxDiscountAmount: c.max_discount_amount ? Number(c.max_discount_amount) : undefined,
        startsAt: c.starts_at || undefined,
        expiresAt: c.expires_at || undefined,
        activeDays: c.active_days || undefined,
      }));
    } catch (err: any) {
      logger.error({ err, restaurantId }, '⚠️ [BOOTSTRAP CATCH] Error querying active coupons');
    }

    // 5b. Resolve Active Special Combos for public customer display
    let activeCombos: any[] = [];
    try {
      const { data: comboRows } = await db.getClient()
        .from('combos')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      activeCombos = (comboRows || []).map((row: any) => {
        const comboPrice = Number(row.combo_price || 0);
        const originalPrice = Number(row.original_price || comboPrice);
        return {
          id: row.id,
          name: row.name,
          description: row.description || null,
          comboPrice,
          originalPrice,
          savingsAmount: Math.max(0, originalPrice - comboPrice),
          imageUrl: row.image_url || null,
          itemsIncluded: Array.isArray(row.items_included) ? row.items_included : [],
        };
      });
    } catch (comboErr: any) {
      logger.error({ err: comboErr, restaurantId }, '⚠️ [BOOTSTRAP CATCH] Error querying active combos');
    }

    // 6. Construct Single Bootstrap Response Contract
    return {
      restaurant: {
        id: restaurant.id,
        slug: slugOrId,
        name: restaurant.name,
        phone: restaurant.phoneNumber,
        address: restaurant.address || null,
        city: restaurant.city || null,
      },
      theme: {
        logoUrl: profile.logoUrl || null,
        coverImageUrl: profile.coverImageUrl || null,
        primaryColor: profile.primaryColor || '#F97316',
        restaurantStory: profile.restaurantStory || null,
        googleReviewUrl: profile.googleReviewUrl || null,
        galleryImages: profile.galleryImages || [],
        secondaryColor: '#2D3748',
        accentColor: '#38A169',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '0.75rem',
        buttonStyle: 'rounded' as const,
      },
      operationalStatus: {
        isOpen: settings.isOpen ?? true,
        isBusy: false,
        maxActiveOrders: settings.maxActiveOrders || 20,
        statusMessage: settings.isOpen ? 'Accepting orders' : 'Restaurant is closed',
      },
      capabilities: {
        dineIn: {
          enabled: settings.supportedOrderModes?.includes('dining') ?? true,
          totalTables: settings.totalTables || 0,
        },
        takeaway: {
          enabled: settings.supportedOrderModes?.includes('takeaway') ?? true,
        },
        paymentMethods: usablePaymentMethods,
        taxes: {
          taxPercentage: settings.gstEnabled ? (settings.gstPercentage || 0) : 0,
        },
      },
      activeCoupons,
      activeCombos,
      menu: {
        categories: enrichedCategories,
      },
    };
  }
}
