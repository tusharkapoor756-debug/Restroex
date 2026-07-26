export interface FieldConfidenceScore {
  value: string | number | null;
  ocrConfidence: number;        // S_ocr (0-100)
  spatialConfidence: number;    // S_spatial (0-100)
  semanticConfidence: number;   // S_semantic (0-100)
  compositeConfidence: number;  // C_field (0-100)
  sourceSection?: string;
}

export interface ReceiptConfidenceModel {
  amountConfidence: number;
  receiverUpiConfidence: number;
  upiReferenceConfidence: number;
  statusConfidence: number;
  overallConfidence: number;
  isHighConfidence: boolean;    // >= 90%
  requiresSecondaryReview: boolean; // < 70%
}

export interface StructuredPaymentReceipt {
  amount: number | null;
  currency: string;
  receiverName: string | null;
  receiverUpi: string | null;
  receiverAccount: string | null;
  senderName: string | null;
  senderUpi: string | null;
  senderAccount: string | null;
  transactionId: string | null;
  upiReference: string | null;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  paymentApp: string | null;
  paymentMethod: string | null;
  bankName: string | null;
  timestamp: string | null;
  date: string | null;
  confidenceScores: ReceiptConfidenceModel;
  rawLineCount: number;
}
