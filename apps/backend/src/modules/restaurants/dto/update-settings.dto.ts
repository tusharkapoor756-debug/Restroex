export interface UpdateSettingsDto {
  // Business Profile
  logoUrl?: string;
  name?: string;
  ownerName?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  // Tax & Billing
  gstEnabled?: boolean;
  gstNumber?: string;
  gstPercentage?: number;
  fssaiNumber?: string;

  // Payment Settings
  paymentMethods?: string[];
  upiMerchantName?: string;
  upiId?: string;
  upiQrImageUrl?: string;
  codEnabled?: boolean;
  manualUpiEnabled?: boolean;
  onlinePaymentsEnabled?: boolean;

  // Store Settings
  pickupAvailable?: boolean;
  prepTime?: number;
  pickupInstructions?: string;

  // New Settings Fields
  invoicePrefix?: string;
  receiptFooter?: string;
  supportPhone?: string;
  supportEmail?: string;
  website?: string;
  instagram?: string;
  invoiceNotes?: string;
  termsAndConditions?: string;
  autoAcceptPaidOrders?: boolean;
}
