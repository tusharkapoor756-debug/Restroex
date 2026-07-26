export type ReceiptSectionType =
  | 'HEADER_SECTION'
  | 'HERO_AMOUNT_SECTION'
  | 'AMOUNT_SECTION'
  | 'STATUS_SECTION'
  | 'RECEIVER_SECTION'
  | 'SENDER_SECTION'
  | 'TRANSACTION_SECTION'
  | 'FOOTER_SECTION';

export interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpatialTextLine {
  lineIndex: number;
  text: string;
  confidence: number;
  boundingBox?: BoundingBox2D;
}

export interface DocumentLayoutBlock {
  blockId: string;
  sectionType: ReceiptSectionType;
  lines: SpatialTextLine[];
  startIndex: number;
  endIndex: number;
  boundary?: BoundingBox2D;
}

export interface ReceiptGrammarDocument {
  documentId: string;
  rawText: string;
  blocks: DocumentLayoutBlock[];
  detectedSections: ReceiptSectionType[];
  createdTimestamp: string;
}
