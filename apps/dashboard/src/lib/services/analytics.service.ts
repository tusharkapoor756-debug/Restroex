import { api } from "../api";

export interface RealDailyAnalytics {
  period: string;
  totalRevenue: number;
  totalOrdersCount: number;
  avgOrderValue: number;
  activeConversationsCount: number;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  hourlyOrders: Record<number, number>;
  paymentBreakdown: Record<string, number>;
}

export class AnalyticsService {
  /**
   * Retrieves real daily analytics overview from backend DB calculations.
   */
  static async getDailyOverview(period: "7d" | "30d" | "90d" = "7d"): Promise<RealDailyAnalytics> {
    const res = await api.get<any>(`/analytics/daily?period=${period}`);
    if (res && typeof res === "object" && "totalRevenue" in res) {
      return res as RealDailyAnalytics;
    }
    return res?.data || {
      period,
      totalRevenue: 0,
      totalOrdersCount: 0,
      avgOrderValue: 0,
      activeConversationsCount: 0,
      topSellingItems: [],
      hourlyOrders: {},
      paymentBreakdown: {},
    };
  }
}
