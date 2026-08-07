export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRToken {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface SpatialLine {
  lineId: string;
  tokens: OCRToken[];
  text: string;
  yCenter: number;
  xMin: number;
  xMax: number;
  bbox: BoundingBox;
}

export interface ImageQualityReport {
  isAcceptable: boolean;
  blurScore: number;
  brightnessScore: number;
  resolution: string;
  warnings: string[];
}

export interface StagedVariant {
  name: string;
  price: number;
  confidence?: number;
}

export interface StagedCustomization {
  name: string;
  priceAdjustment: number;
  confidence?: number;
}

export interface StagedMenuItem {
  id?: string;
  categoryName: string;
  subcategoryName?: string | null;
  itemName: string;
  description?: string | null;
  basePrice: number | null;
  vegType: 'veg' | 'non-veg' | 'egg' | 'vegan';
  isBestseller: boolean;
  variants: StagedVariant[];
  customizations: StagedCustomization[];
  boundingBox?: BoundingBox | null;
  confidenceScore: number;
  needsReview: boolean;
  matchedMenuItemId?: string | null;
  syncAction: 'create' | 'update' | 'merge' | 'ignore';
}

export interface ParsedCategoryGroup {
  id: string;
  name: string;
  confidence: number;
  items: StagedMenuItem[];
}

export interface DryRunSummary {
  totalExtracted: number;
  newItemsCount: number;
  updatedItemsCount: number;
  mergedItemsCount: number;
  needsReviewCount: number;
}

export interface ImportSessionPayload {
  sessionId: string;
  restaurantId: string;
  status: 'queued' | 'processing' | 'draft' | 'committed' | 'failed' | 'cancelled';
  importMode: 'append' | 'replace_category' | 'full_sync';
  originalFilename: string;
  fileUrl: string;
  qualityReport?: ImageQualityReport | null;
  dryRunSummary?: DryRunSummary | null;
  categories: ParsedCategoryGroup[];
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}
