export interface VariantInputDto {
  variantName: string;
  price: number;
}

export interface CreateMenuItemDto {
  name: string;
  basePrice: number;
  aliases?: string[];
  variants?: VariantInputDto[];
}

export interface UpdateMenuItemDto {
  name?: string;
  basePrice?: number;
  aliases?: string[];
  variants?: VariantInputDto[];
}
