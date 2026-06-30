import { api } from "../api";
import { RestaurantSetupResponse, RestaurantSetupUpdate } from "../../types";

export class RestaurantService {
  /**
   * Retrieves the current setup state of the restaurant.
   */
  static async getSetup(): Promise<RestaurantSetupResponse> {
    return api.get<RestaurantSetupResponse>("/restaurants/setup");
  }

  /**
   * Partially updates the restaurant's setup information.
   */
  static async updateSetup(update: RestaurantSetupUpdate): Promise<RestaurantSetupResponse> {
    return api.patch<RestaurantSetupResponse>("/restaurants/setup", update);
  }

  /**
   * Completes the restaurant setup process. Validates that all required fields are present.
   */
  static async completeSetup(update: RestaurantSetupUpdate): Promise<RestaurantSetupResponse> {
    return api.post<RestaurantSetupResponse>("/restaurants/setup/complete", update);
  }
}
