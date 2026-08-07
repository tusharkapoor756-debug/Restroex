import { api } from "../api";

export interface MetricTrend {
  value: number;
  prev: number;
  pct: number;
  isIncrease: boolean;
  diff: number;
}

export interface BusinessOverview {
  totalRevenue: MetricTrend;
  totalOrders: MetricTrend;
  completedOrders: MetricTrend;
  cancelledOrders: MetricTrend;
  avgOrderValue: MetricTrend;
  totalCustomers: MetricTrend;
  repeatCustomerPct: MetricTrend;
  paymentSuccessPct: MetricTrend;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface MenuPerformanceItem {
  id?: string;
  name: string;
  quantity: number;
  revenue: number;
  ordersCount: number;
  avgQtyPerOrder: number;
  avgRevenuePerItem: number;
  revenueContributionPct: number;
}

export interface CustomerAnalyticsData {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatRatePct: number;
  avgSpendPerCustomer: number;
  highestSpendingCustomer: { name: string; spend: number } | null;
  highestOrderingCustomer: { name: string; orders: number } | null;
}

export interface PeakHourItem {
  hour: number;
  ordersCount: number;
  revenue: number;
}

export interface PeakHoursData {
  hourly: PeakHourItem[];
  peakHour: string;
  slowestHour: string;
  avgOrdersPerHour: number;
}

export interface PaymentAnalyticsData {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  successRatePct: number;
  failureRatePct: number;
  gatewayBreakdown: Record<string, { total: number; success: number; failed: number; amount: number }>;
}

export interface WhatsappAnalyticsData {
  totalConversations: number;
  activeConversations: number;
  ordersGenerated: number;
  conversionRatePct: number;
  invoicePdfsSent: number;
  notificationsSent: number;
}

export interface OperationalAnalyticsData {
  avgAcceptanceTimeSec: number;
  avgKitchenPrepTimeMin: number;
  avgCompletionTimeMin: number;
  fastestCompletedOrderMin: number;
  slowestCompletedOrderMin: number;
}

export interface BusinessAlert {
  type: "warning" | "info" | "critical";
  title: string;
  message: string;
}

export interface AnalyticsOverviewResponse {
  period: string;
  startDate: string;
  endDate: string;
  businessOverview: BusinessOverview;
  revenueTrend: RevenueTrendPoint[];
  orderStatusDistribution: {
    completed: number;
    preparing: number;
    ready: number;
    pending: number;
    cancelled: number;
    refunded: number;
  };
  avgOrdersPerDay: number;
  menuPerformance: {
    all: MenuPerformanceItem[];
    topSelling: MenuPerformanceItem[];
    highestRevenue: MenuPerformanceItem[];
    leastSelling: MenuPerformanceItem[];
    neverOrdered: string[];
  };
  customerAnalytics: CustomerAnalyticsData;
  peakHoursData: PeakHoursData;
  paymentAnalytics: PaymentAnalyticsData;
  whatsappAnalytics: WhatsappAnalyticsData;
  operationalAnalytics: OperationalAnalyticsData;
  alerts: BusinessAlert[];
}

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
   * Retrieves comprehensive production analytics overview with period comparisons.
   */
  static async getOverview(
    period: "today" | "yesterday" | "7d" | "30d" | "90d" | "custom" = "7d",
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsOverviewResponse> {
    let url = `/analytics/overview?period=${period}`;
    if (period === "custom" && startDate && endDate) {
      url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    }
    const res = await api.get<any>(url);
    return (res?.data || res) as AnalyticsOverviewResponse;
  }

  /**
   * Legacy compatibility method for main Dashboard overview cards.
   */
  static async getDailyOverview(period: "7d" | "30d" | "90d" = "7d"): Promise<RealDailyAnalytics> {
    const fullData = await this.getOverview(period);
    const hourlyOrdersMap: Record<number, number> = {};
    (fullData?.peakHoursData?.hourly || []).forEach((h) => {
      hourlyOrdersMap[h.hour] = h.ordersCount;
    });

    const paymentBreakdownMap: Record<string, number> = {};
    if (fullData?.paymentAnalytics?.gatewayBreakdown) {
      Object.entries(fullData.paymentAnalytics.gatewayBreakdown).forEach(([k, v]) => {
        paymentBreakdownMap[k] = v.amount;
      });
    }

    return {
      period,
      totalRevenue: fullData?.businessOverview?.totalRevenue?.value || 0,
      totalOrdersCount: fullData?.businessOverview?.totalOrders?.value || 0,
      avgOrderValue: fullData?.businessOverview?.avgOrderValue?.value || 0,
      activeConversationsCount: fullData?.whatsappAnalytics?.activeConversations || 0,
      topSellingItems: (fullData?.menuPerformance?.topSelling || []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        revenue: i.revenue,
      })),
      hourlyOrders: hourlyOrdersMap,
      paymentBreakdown: paymentBreakdownMap,
    };
  }
}
