import { RestaurantSettings } from "../../types";

export class SettingsService {
  /**
   * Placeholder: Retrieves detailed restaurant settings (beyond basic setup).
   * NOTE: Backend endpoint does not exist yet.
   */
  static async getSettings(): Promise<RestaurantSettings | null> {
    // throw new Error("Not implemented: Endpoint /settings does not exist.");
    return null;
  }
  
  /**
   * Placeholder: Updates detailed restaurant settings.
   */
  static async updateSettings(settings: Partial<RestaurantSettings>): Promise<RestaurantSettings | null> {
    // throw new Error("Not implemented: Endpoint /settings does not exist.");
    return null;
  }
}
