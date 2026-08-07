export interface Customer {
  id: string;
  restaurantId: string;
  customerCode?: string | null;
  phone: string; // Internal WhatsApp / LID Communication Identifier (UNTOUCHED)
  contactPhone: string | null; // Customer Preferred Contact Phone Number
  primaryPhone?: string | null;
  whatsappLid?: string | null;
  createdSource?: string | null;
  name: string | null; // Customer Display Name
  address: string | null;
  notes?: string | null;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
  totalOrders?: number;
  totalSpend?: number;
  isMerged?: boolean;
  mergedIntoCustomerId?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCustomerDto {
  restaurantId: string;
  customerCode?: string;
  phone: string;
  contactPhone?: string;
  primaryPhone?: string;
  whatsappLid?: string;
  createdSource?: string;
  name?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerDto {
  contactPhone?: string;
  primaryPhone?: string;
  whatsappLid?: string;
  name?: string;
  address?: string;
  notes?: string;
}


