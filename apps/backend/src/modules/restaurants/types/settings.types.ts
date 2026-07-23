export interface RestaurantSettings {
  id: string;
  restaurantId: string;
  
  // Tax & Billing
  gstEnabled: boolean;
  gstNumber?: string;
  gstPercentage: number;
  fssaiNumber?: string;

  // Payment Settings
  paymentMethods: string[]; // e.g. ['manual_upi']
  upiMerchantName?: string;
  upiId?: string;
  upiQrImageUrl?: string;
  codEnabled: boolean;
  manualUpiEnabled: boolean;

  // Store Settings
  pickupAvailable: boolean;
  prepTime: number; // in minutes
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
  autoAcceptPaidOrders: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  logoUrl?: string;
  name: string;
  ownerName?: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface FullSettings {
  profile: BusinessProfile;
  settings: RestaurantSettings;
}
