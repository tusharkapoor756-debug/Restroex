export interface BaseMenuItem {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
}

export interface MenuVariant {
  id: string;
  menuItemId: string;
  variantName: string;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
}

export interface MenuCustomization {
  id: string;
  menuItemId: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemWithVariants {
  id: string;
  restaurantId: string;
  name: string;
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  vegType: 'veg' | 'non-veg';
  preparationTime: number;
  isPopular: boolean;
  isRecommended: boolean;
  displayOrder: number;
  allowInstructions?: boolean;
  createdAt: string;
  updatedAt: string;
  variants: MenuVariant[];
  customizations?: MenuCustomization[];
}

export interface Category {
  id: string;
  restaurantId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  displayOrder: number;
  icon?: string | null;
  imageUrl?: string | null;
  isVisible: boolean;
  availableFrom?: string | null;
  availableTill?: string | null;
  createdAt: string;
  updatedAt: string;
}
