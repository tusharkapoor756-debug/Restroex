import { Tool, ToolContext } from '../types/tools.types';
import { MenuRepository } from '../../menu/repositories/menu.repository';

interface CachedMenu {
  items: any;
  timestamp: number;
}

export class GetMenuTool implements Tool<void, any> {
  public readonly definition = {
    name: 'get_menu',
    description: 'Retrieves the complete active menu items for the restaurant, including their variant options and base prices.',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  private readonly menuRepository: MenuRepository;
  private static readonly menuCache = new Map<string, CachedMenu>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor() {
    this.menuRepository = new MenuRepository();
  }

  public async execute(args: void, context: ToolContext): Promise<any> {
    const cached = GetMenuTool.menuCache.get(context.restaurantId);
    if (cached && (Date.now() - cached.timestamp < GetMenuTool.CACHE_TTL_MS)) {
      return { menu: cached.items };
    }

    const items = await this.menuRepository.listByRestaurantWithVariants(context.restaurantId);
    const mapped = items.map((item) => ({
      id: item.id,
      name: item.name,
      available: item.isAvailable,
      basePrice: item.basePrice,
      variants: item.variants.map((v: any) => ({
        id: v.id,
        variantName: v.variantName,
        price: v.price,
      })),
    }));

    GetMenuTool.menuCache.set(context.restaurantId, {
      items: mapped,
      timestamp: Date.now(),
    });

    return { menu: mapped };
  }
}

