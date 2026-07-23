import { api } from "../api";
import {
  MenuItem,
  Category,
  MenuCustomization,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from "../../types";

export class MenuService {
  // ── Categories ────────────────────────────────────────────────────────────

  static async listCategories(): Promise<Category[]> {
    return api.get<Category[]>("/menu/categories");
  }

  static async createCategory(data: CreateCategoryDto): Promise<Category> {
    return api.post<Category>("/menu/categories", data);
  }

  static async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    return api.put<Category>(`/menu/categories/${id}`, data);
  }

  static async deleteCategory(id: string): Promise<void> {
    return api.delete<void>(`/menu/categories/${id}`);
  }

  static async reorderCategories(items: { id: string; displayOrder: number }[]): Promise<void> {
    return api.post<void>("/menu/categories/reorder", { items });
  }

  // ── Menu Items ────────────────────────────────────────────────────────────

  static async listItems(): Promise<MenuItem[]> {
    return api.get<MenuItem[]>("/menu/items");
  }

  static async createItem(data: CreateMenuItemDto): Promise<MenuItem> {
    return api.post<MenuItem>("/menu/items", data);
  }

  static async updateItem(itemId: string, data: UpdateMenuItemDto): Promise<MenuItem> {
    return api.put<MenuItem>(`/menu/items/${itemId}`, data);
  }

  static async deleteItem(itemId: string): Promise<void> {
    return api.delete<void>(`/menu/items/${itemId}`);
  }

  static async updateAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return api.patch<MenuItem>(`/menu/items/${itemId}/availability`, { isAvailable });
  }

  static async reorderItems(items: { id: string; displayOrder: number }[]): Promise<void> {
    return api.post<void>("/menu/items/reorder", { items });
  }

  // ── Customizations ────────────────────────────────────────────────────────

  static async listCustomizations(menuItemId: string): Promise<MenuCustomization[]> {
    return api.get<MenuCustomization[]>(`/menu/items/${menuItemId}/customizations`);
  }

  static async createCustomization(
    menuItemId: string,
    data: { name: string; priceAdjustment: number; isAvailable: boolean },
  ): Promise<MenuCustomization> {
    return api.post<MenuCustomization>(`/menu/items/${menuItemId}/customizations`, data);
  }

  static async updateCustomization(
    menuItemId: string,
    customizationId: string,
    data: { name?: string; priceAdjustment?: number; isAvailable?: boolean },
  ): Promise<MenuCustomization> {
    return api.put<MenuCustomization>(
      `/menu/items/${menuItemId}/customizations/${customizationId}`,
      data,
    );
  }

  static async deleteCustomization(menuItemId: string, customizationId: string): Promise<void> {
    return api.delete<void>(`/menu/items/${menuItemId}/customizations/${customizationId}`);
  }
}
