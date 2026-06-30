import { DailyAnalytics } from "../../types";

export class AnalyticsService {
  /**
   * Placeholder: Retrieves daily analytics overview.
   * NOTE: Backend endpoint does not exist yet.
   */
  static async getDailyOverview(): Promise<DailyAnalytics> {
    // throw new Error("Not implemented: Endpoint /analytics/daily does not exist.");
    
    // Returning dummy typed data for now so UI doesn't break
    return {
      totalRevenue: 0,
      totalOrders: 0,
      avgPrepTimeMinutes: 0,
      whatsappMessageCount: 0,
      aiHitRate: 0,
    };
  }
}
