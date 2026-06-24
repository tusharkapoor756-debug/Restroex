import { BadRequestError } from '../../../shared/errors/app-error';
import { MenuRepository } from '../repositories/menu.repository';

export class MenuService {
  private readonly repository: MenuRepository;

  constructor() {
    this.repository = new MenuRepository();
  }

  public async listMenu(restaurantId: string) {
    return await this.repository.listByRestaurant(restaurantId);
  }

  public async createMenuItem(restaurantId: string, dto: any) {
    const name = String(dto.name || '').trim();
    const basePrice = Number(dto.basePrice ?? dto.price);
    const aliases = Array.isArray(dto.aliases)
      ? dto.aliases.map((alias: unknown) => String(alias).trim()).filter(Boolean)
      : String(dto.aliases || '')
          .split(',')
          .map((alias) => alias.trim())
          .filter(Boolean);

    if (!name || !Number.isFinite(basePrice) || basePrice < 0) {
      throw new BadRequestError('Menu item name and valid price are required');
    }

    return await this.repository.create(restaurantId, { name, aliases, basePrice });
  }

  public async updateAvailability(restaurantId: string, itemId: string, isAvailable: boolean) {
    return await this.repository.setAvailability(restaurantId, itemId, isAvailable);
  }
}
