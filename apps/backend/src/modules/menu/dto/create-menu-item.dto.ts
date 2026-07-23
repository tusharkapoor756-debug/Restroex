export interface VariantInputDto {
  variantName: string;
  price: number;
  displayOrder?: number;
}

export interface CustomizationInputDto {
  name: string;
  priceAdjustment: number;
  isAvailable?: boolean;
}

export interface CreateMenuItemDto {
  name: string;
  basePrice?: number;
  aliases?: string[];
  variants?: VariantInputDto[];
  // Dynamic fields
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  imageUrl?: string;
  vegType?: 'veg' | 'non-veg';
  preparationTime?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  displayOrder?: number;
}

export interface UpdateMenuItemDto {
  name?: string;
  basePrice?: number;
  aliases?: string[];
  variants?: VariantInputDto[];
  // Dynamic fields
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  vegType?: 'veg' | 'non-veg';
  preparationTime?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  displayOrder?: number;
}

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  description?: string;
  displayOrder?: number;
  icon?: string;
  imageUrl?: string;
  isVisible?: boolean;
  availableFrom?: string;
  availableTill?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string | null;
  description?: string | null;
  displayOrder?: number;
  icon?: string | null;
  imageUrl?: string | null;
  isVisible?: boolean;
  availableFrom?: string | null;
  availableTill?: string | null;
}

export interface ReorderDto {
  items: Array<{ id: string; displayOrder: number }>;
}

export interface CreateCustomizationDto {
  name: string;
  priceAdjustment?: number;
  isAvailable?: boolean;
}

export interface UpdateCustomizationDto {
  name?: string;
  priceAdjustment?: number;
  isAvailable?: boolean;
}
