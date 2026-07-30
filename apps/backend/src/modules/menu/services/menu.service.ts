import { BadRequestError } from '../../../shared/errors/app-error';
import { MenuRepository } from '../repositories/menu.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { CustomizationRepository } from '../repositories/customization.repository';
import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  VariantInputDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderDto,
  CreateCustomizationDto,
  UpdateCustomizationDto,
} from '../dto/create-menu-item.dto';
import { ContextBuilderService } from '../../ai/services/context-builder.service';

export class MenuService {
  private readonly repository: MenuRepository;
  private readonly categoryRepository: CategoryRepository;
  private readonly customizationRepository: CustomizationRepository;

  constructor() {
    this.repository = new MenuRepository();
    this.categoryRepository = new CategoryRepository();
    this.customizationRepository = new CustomizationRepository();
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  public async listCategories(restaurantId: string) {
    return this.categoryRepository.listByRestaurant(restaurantId);
  }

  public async createCategory(restaurantId: string, dto: CreateCategoryDto) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestError('Category name is required');

    return this.categoryRepository.create(restaurantId, {
      parentId: dto.parentId || null,
      name,
      description: dto.description,
      displayOrder: dto.displayOrder,
      icon: dto.icon,
      imageUrl: dto.imageUrl,
      isVisible: dto.isVisible,
      availableFrom: dto.availableFrom,
      availableTill: dto.availableTill,
    });
  }

  public async updateCategory(restaurantId: string, id: string, dto: UpdateCategoryDto) {
    const existing = await this.categoryRepository.findById(restaurantId, id);
    if (!existing) throw new BadRequestError(`Category ${id} not found`);

    return this.categoryRepository.update(restaurantId, id, {
      parentId: dto.parentId,
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
      icon: dto.icon,
      imageUrl: dto.imageUrl,
      isVisible: dto.isVisible,
      availableFrom: dto.availableFrom,
      availableTill: dto.availableTill,
    });
  }

  public async deleteCategory(restaurantId: string, id: string) {
    const existing = await this.categoryRepository.findById(restaurantId, id);
    if (!existing) throw new BadRequestError(`Category ${id} not found`);
    await this.categoryRepository.delete(restaurantId, id);
  }

  public async reorderCategories(restaurantId: string, dto: ReorderDto) {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestError('items array required for reorder');
    }
    await this.categoryRepository.updateOrder(restaurantId, dto.items);
  }

  // ─── Menu Items ───────────────────────────────────────────────────────────

  public async listMenu(restaurantId: string) {
    return this.repository.listByRestaurant(restaurantId);
  }

  public async listMenuWithVariants(restaurantId: string) {
    return this.repository.listByRestaurantWithVariants(restaurantId);
  }

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

    if (!name) throw new BadRequestError('Menu item name is required');

    if (!hasVariants) {
      if (basePrice === null || !Number.isFinite(basePrice) || basePrice < 0) {
        throw new BadRequestError('Base price is required when no variants exist');
      }
    } else {
      if (basePrice !== null && (!Number.isFinite(basePrice) || basePrice < 0)) {
        throw new BadRequestError('Invalid base price');
      }
    }

    const result = await this.repository.createWithVariants(restaurantId, {
      name,
      aliases,
      basePrice,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      description: dto.description,
      imageUrl: dto.imageUrl,
      vegType: dto.vegType,
      preparationTime: dto.preparationTime,
      isPopular: dto.isPopular,
      isRecommended: dto.isRecommended,
      displayOrder: dto.displayOrder,
      allowInstructions: dto.allowInstructions,
      variants,
    });

    // Invalidate the AI context cache so changes are reflected immediately
    ContextBuilderService.invalidateCache(restaurantId);

    return result;
  }

  public async updateMenuItem(restaurantId: string, itemId: string, dto: UpdateMenuItemDto) {
    const existing = await this.repository.findById(restaurantId, itemId);
    if (!existing) throw new BadRequestError(`Menu item ${itemId} not found`);

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

    // Conditional validation
    if (!finalHasVariants) {
      const finalBasePrice = basePrice !== undefined ? basePrice : existing.basePrice;
      if (finalBasePrice === null || !Number.isFinite(finalBasePrice) || finalBasePrice < 0) {
        throw new BadRequestError('Base price is required when no variants exist');
      }
    } else {
      const finalBasePrice = basePrice !== undefined ? basePrice : existing.basePrice;
      if (
        finalBasePrice !== null &&
        finalBasePrice !== undefined &&
        (!Number.isFinite(finalBasePrice) || finalBasePrice < 0)
      ) {
        throw new BadRequestError('Invalid base price');
      }
    }

    const updated = await this.repository.updateItem(restaurantId, itemId, {
      name,
      aliases,
      basePrice,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      description: dto.description,
      imageUrl: dto.imageUrl,
      vegType: dto.vegType,
      preparationTime: dto.preparationTime,
      isPopular: dto.isPopular,
      isRecommended: dto.isRecommended,
      displayOrder: dto.displayOrder,
      allowInstructions: dto.allowInstructions,
    });

    let savedVariants = await this.repository.findVariants(itemId);
    if (variants !== undefined) {
      savedVariants = await this.repository.replaceVariants(itemId, variants);
    }

    // Invalidate the AI context cache
    ContextBuilderService.invalidateCache(restaurantId);

    return { ...updated, variants: savedVariants };
  }

  public async updateAvailability(restaurantId: string, itemId: string, isAvailable: boolean) {
    const result = await this.repository.setAvailability(restaurantId, itemId, isAvailable);
    ContextBuilderService.invalidateCache(restaurantId);
    return result;
  }

  public async deleteMenuItem(restaurantId: string, itemId: string) {
    const existing = await this.repository.findById(restaurantId, itemId);
    if (!existing) throw new BadRequestError(`Menu item ${itemId} not found`);
    await this.repository.delete(restaurantId, itemId);
    ContextBuilderService.invalidateCache(restaurantId);
  }

  public async reorderItems(restaurantId: string, dto: ReorderDto) {
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestError('items array required for reorder');
    }
    await this.repository.updateItemsOrder(restaurantId, dto.items);
    ContextBuilderService.invalidateCache(restaurantId);
  }

  // ─── Customizations ───────────────────────────────────────────────────────

  public async listCustomizations(menuItemId: string) {
    return this.customizationRepository.listByMenuItem(menuItemId);
  }

  public async createCustomization(menuItemId: string, dto: CreateCustomizationDto) {
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestError('Customization name is required');

    return this.customizationRepository.create(menuItemId, {
      name,
      priceAdjustment: dto.priceAdjustment ?? 0,
      isAvailable: dto.isAvailable ?? true,
    });
  }

  public async updateCustomization(id: string, dto: UpdateCustomizationDto) {
    const existing = await this.customizationRepository.findById(id);
    if (!existing) throw new BadRequestError(`Customization ${id} not found`);
    return this.customizationRepository.update(id, dto);
  }

  public async deleteCustomization(id: string) {
    const existing = await this.customizationRepository.findById(id);
    if (!existing) throw new BadRequestError(`Customization ${id} not found`);
    await this.customizationRepository.delete(id);
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

  private parseVariants(raw: any): (VariantInputDto & { displayOrder?: number })[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw
      .filter((v: any) => v && String(v.variantName || '').trim())
      .map((v: any, idx: number) => ({
        variantName: String(v.variantName).trim(),
        price: Number(v.price ?? 0),
        displayOrder: v.displayOrder ?? idx,
      }))
      .filter((v) => Number.isFinite(v.price) && v.price >= 0);
  }
}
