export interface Customer {
  id: string;
  restaurantId: string;
  phone: string;
  name: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateCustomerDto {
  restaurantId: string;
  phone: string;
  name?: string;
  address?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  address?: string;
}
