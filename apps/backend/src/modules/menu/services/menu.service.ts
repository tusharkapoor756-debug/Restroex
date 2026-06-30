import { BadRequestError } from '../../../shared/errors/app-error';
import { MenuRepository } from '../repositories/menu.repository';
import { CreateMenuItemDto, UpdateMenuItemDto, VariantInputDto } from '../dto/create-menu-item.dto';

export class MenuService {
  private readonly repository: MenuRepository;

  constructor() {
    this.repository = new MenuRepository();
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  public async listMenu(restaurantId: string) {
    return this.repository.listByRestaurant(restaurantId);
  }

  public async listMenuWithVariants(restaurantId: string) {
    return this.repository.listByRestaurantWithVariants(restaurantId);
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  public async createMenuItem(restaurantId: string, dto: CreateMenuItemDto) {
    const name = String(dto.name || '').trim();
    const aliases = this.parseAliases(dto.aliases);
    const variants = this.parseVariants(dto.variants);
    const hasVariants = variants.length > 0;

    let basePrice: number | null = null;
    const rawPrice = dto.basePrice ?? (dto as any).price;
    if (rawPrice !== undefined && rawPrice !== null && (rawPrice as any) !== '') {
      basePrice = Number(rawPrice);
    }

    if (!name) {
      throw new BadRequestError('Menu item name is required');
    }

    if (!hasVariants) {
      if (basePrice === null || !Number.isFinite(basePrice) || basePrice < 0) {
        throw new BadRequestError('Base price is required when no variants exist');
      }
    } else {
      if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) {
        throw new BadRequestError('Invalid base price');
      }
    }

    return this.repository.createWithVariants(restaurantId, { name, aliases, basePrice, variants });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  public async updateMenuItem(restaurantId: string, itemId: string, dto: UpdateMenuItemDto) {
    const existing = await this.repository.findById(restaurantId, itemId);
    if (!existing) {
      throw new BadRequestError(`Menu item ${itemId} not found`);
    }

    const name = dto.name !== undefined ? String(dto.name).trim() : undefined;
    const aliases = dto.aliases !== undefined ? this.parseAliases(dto.aliases) : undefined;
    const variants = dto.variants !== undefined ? this.parseVariants(dto.variants) : undefined;
    
    // Check if variants will exist after update
    let finalHasVariants = false;
    if (variants !== undefined) {
      finalHasVariants = variants.length > 0;
    } else {
      const currentVariants = await this.repository.findVariants(itemId);
      finalHasVariants = currentVariants.length > 0;
    }

    let basePrice: number | null | undefined = undefined;
    if (dto.basePrice !== undefined) {
      const rawPrice = dto.basePrice;
      if (rawPrice !== null && (rawPrice as any) !== '') {
        basePrice = Number(rawPrice);
      } else {
        basePrice = null;
      }
    }

    if (name !== undefined && !name) {
      throw new BadRequestError('Menu item name cannot be empty');
    }

    // Apply conditional validation rules
    if (!finalHasVariants) {
      // Base price is required
      const finalBasePrice = basePrice !== undefined ? basePrice : existing.basePrice;
      if (finalBasePrice === null || !Number.isFinite(finalBasePrice) || finalBasePrice < 0) {
        throw new BadRequestError('Base price is required when no variants exist');
      }
    } else {
      // Base price is optional
      const finalBasePrice = basePrice !== undefined ? basePrice : existing.basePrice;
      if (finalBasePrice !== null && finalBasePrice !== undefined && (!Number.isFinite(finalBasePrice) || finalBasePrice < 0)) {
        throw new BadRequestError('Invalid base price');
      }
    }

    // Update core fields
    const updated = await this.repository.updateItem(restaurantId, itemId, { name, aliases, basePrice });

    // Replace variants if provided
    let savedVariants = await this.repository.findVariants(itemId);
    if (variants !== undefined) {
      savedVariants = await this.repository.replaceVariants(itemId, variants);
    }

    return { ...updated, variants: savedVariants };
  }

  // ─── Availability ─────────────────────────────────────────────────────────

  public async updateAvailability(restaurantId: string, itemId: string, isAvailable: boolean) {
    return this.repository.setAvailability(restaurantId, itemId, isAvailable);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private parseAliases(raw: any): string[] {
    if (Array.isArray(raw)) {
      return raw.map((a: unknown) => String(a).trim()).filter(Boolean);
    }
    return String(raw || '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }

  private parseVariants(raw: any): VariantInputDto[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw
      .filter((v: any) => v && String(v.variantName || '').trim())
      .map((v: any) => ({
        variantName: String(v.variantName).trim(),
        price: Number(v.price ?? 0),
      }))
      .filter((v) => Number.isFinite(v.price) && v.price >= 0);
  }
}
