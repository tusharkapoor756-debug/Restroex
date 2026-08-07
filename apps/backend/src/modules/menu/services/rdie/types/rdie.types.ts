export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRToken {
  id: string;
  text: string;
  bbox: BBox;
  confidence: number;
  fontSizeEstimate: number;
  isNumeric: boolean;
  isCurrencySymbol: boolean;
}

export interface ColumnBounds {
  columnIndex: number;
  x0: number;
  x1: number;
  tokenCount: number;
}

export interface SpatialLine {
  id: string;
  columnIndex: number;
  bbox: BBox;
  tokens: OCRToken[];
  text: string;
  medianFontSize: number;
  isCentered: boolean;
  isUppercase: boolean;
}

export interface SpatialBlock {
  id: string;
  columnIndex: number;
  bbox: BBox;
  lines: SpatialLine[];
}

export interface HeadingNode {
  id: string;
  name: string;
  rawText: string;
  columnIndex: number;
  bbox: BBox;
  confidence: number;
  headingScore: number;
}

export interface PriceEntity {
  id: string;
  value: number;
  rawText: string;
  bbox: BBox;
  columnIndex: number;
  isDiscounted?: boolean;
}

export interface VariantSpec {
  name: string;
  xCenter: number;
}

export interface VariantMatrixSpec {
  columnIndex: number;
  yPosition: number;
  variants: VariantSpec[];
}

export interface RawMenuItem {
  id: string;
  name: string;
  description?: string;
  dietary?: 'VEG' | 'NON_VEG' | 'EGG' | 'UNKNOWN';
  columnIndex: number;
  bbox: BBox;
  categoryId?: string;
  categoryName?: string;
  hasVariants: boolean;
  variants: Array<{ name: string; price: number; confidence: number }>;
  basePrice?: number | null;
  confidence: number;
}

export interface RDIEOutput {
  engineVersion: string;
  confidenceScore: number;
  metadata: {
    detectedColumns: number;
    processedDpi: number;
    tokenCount: number;
    headingCount: number;
    itemCount: number;
  };
  categories: Array<{
    id: string;
    name: string;
    confidence: number;
    boundingBox: BBox;
    items: RawMenuItem[];
  }>;
}
