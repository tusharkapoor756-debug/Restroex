export interface Customer {
  id: string;
  restaurantId: string;
  phone: string; // Internal WhatsApp / LID Communication Identifier (UNTOUCHED)
  contactPhone: string | null; // Customer Preferred Contact Phone Number
  name: string | null; // Customer Display Name
  address: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCustomerDto {
  restaurantId: string;
  phone: string;
  contactPhone?: string;
  name?: string;
  address?: string;
}

export interface UpdateCustomerDto {
  contactPhone?: string;
  name?: string;
  address?: string;
}
