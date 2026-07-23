import { api } from '../api';
import { FullSettings, UpdateSettingsPayload } from '../../types';

export class SettingsService {
  /**
   * Fetches the full restaurant settings (business profile + billing + payment + store config).
   * Calls: GET /restaurants/settings
   */
  static async getSettings(): Promise<FullSettings> {
    return api.get<FullSettings>('/restaurants/settings');
  }

  /**
   * Updates any subset of restaurant settings.
   * Calls: PATCH /restaurants/settings
   */
  static async updateSettings(payload: UpdateSettingsPayload): Promise<FullSettings> {
    return api.patch<FullSettings>('/restaurants/settings', payload);
  }
}
