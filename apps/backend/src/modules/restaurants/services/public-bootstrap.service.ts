import { RestaurantRepository } from '../repositories/restaurant.repository';
import { SettingsService } from './settings.service';
import { MenuService } from '../../menu/services/menu.service';
import { NotFoundError } from '../../../shared/errors/app-error';

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

    // 5. Construct Single Bootstrap Response Contract
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
        // Logo comes from BusinessProfile if set in Dashboard Settings.
        logoUrl: profile.logoUrl || null,
        coverImageUrl: null, // future: add coverImageUrl field to BusinessProfile
        primaryColor: '#E53E3E',
        secondaryColor: '#2D3748',
        accentColor: '#38A169',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '0.75rem',
        buttonStyle: 'rounded' as const,
      },
      operationalStatus: {
        isOpen: settings.isOpen ?? true,
        // isBusy requires a live active-order count query — not available from settings.
        // Future: query ORDER count with status IN ('received','accepted','preparing').
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
          // gstPercentage is the actual field name in RestaurantSettings
          taxPercentage: settings.gstEnabled ? (settings.gstPercentage || 0) : 0,
        },
      },
      menu: {
        categories: enrichedCategories,
      },
    };
  }
}
