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
}

export interface MenuItemWithVariants {
  id: string;
  restaurantId: string;
  name: string;
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  variants: MenuVariant[];
}
