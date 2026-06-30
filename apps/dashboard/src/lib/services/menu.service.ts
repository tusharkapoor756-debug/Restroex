import { api } from "../api";
import { MenuItem, CreateMenuItemDto, UpdateMenuItemDto } from "../../types";

export class MenuService {
  /**
   * Retrieves all menu items with their variants for the restaurant.
   */
  static async listItems(): Promise<MenuItem[]> {
    return api.get<MenuItem[]>("/menu/items");
  }

  /**
   * Creates a new menu item, optionally with variants.
   */
  static async createItem(data: CreateMenuItemDto): Promise<MenuItem> {
    return api.post<MenuItem>("/menu/items", data);
  }

  /**
   * Updates an existing menu item and replaces its variants.
   */
  static async updateItem(itemId: string, data: UpdateMenuItemDto): Promise<MenuItem> {
    return api.put<MenuItem>(`/menu/items/${itemId}`, data);
  }

  /**
   * Updates the availability of a menu item.
   */
  static async updateAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return api.patch<MenuItem>(`/menu/items/${itemId}/availability`, { isAvailable });
  }
}
