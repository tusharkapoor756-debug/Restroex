import { api } from "../api";

export interface SystemHealthItem {
  status: "HEALTHY" | "WARNING" | "OFFLINE" | "ERROR";
  [key: string]: any;
}

export interface SystemHealthMatrix {
  store: { status: "HEALTHY" | "WARNING" | "OFFLINE"; isStoreOpen: boolean; name: string };
  whatsApp: { status: "HEALTHY" | "WARNING" | "OFFLINE"; gateway: string };
  paymentGateway: { status: "HEALTHY" | "WARNING"; failedCountToday: number };
  database: { status: "HEALTHY" | "ERROR" };
  apiBackend: { status: "HEALTHY" };
  realtimeSync: { status: "HEALTHY" };
  backgroundQueue: { status: "HEALTHY" | "WARNING" };
}

export interface TodayKpis {
  todayRevenue: number;
  todayTotalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  cancelledOrders: number;
  completedOrders: number;
  activeConversations: number;
}

export interface ImmediateAttentionItem {
  id: string;
  severity: "critical" | "warning";
  title: string;
  message: string;
  actionLabel?: string;
  actionTarget?: string;
}

export interface ActiveOrderItem {
  id: string;
  humanReadableId: string;
  customerPhone: string;
  customerName: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  elapsedMins: number;
  isDelayed: boolean;
  items: Array<{ name: string; quantity: number; price: number }>;
}

export interface KitchenQueue {
  waiting: ActiveOrderItem[];
  preparing: ActiveOrderItem[];
  ready: ActiveOrderItem[];
}

export interface ActivityFeedItem {
  id: string;
  time: string;
  timestamp: string;
  message: string;
  status: string;
}

export interface BusinessAlert {
  type: "warning" | "critical" | "info";
  title: string;
  message: string;
}

export interface TopSellingItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface OperationsHubResponse {
  timestamp: string;
  systemHealth: SystemHealthMatrix;
  todayKpis: TodayKpis;
  immediateAttention: ImmediateAttentionItem[];
  activeOrders: ActiveOrderItem[];
  kitchenQueue: KitchenQueue;
  recentActivityFeed: ActivityFeedItem[];
  businessAlerts: BusinessAlert[];
  todayTopSellingItems: TopSellingItem[];
  paymentSnapshotByGateway: Record<string, { collected: number; pending: number; failed: number }>;
  customerSnapshot: { todayNewCustomers: number; todayReturningCustomers: number };
}

export class OperationsService {
  /**
   * Fetches real-time operational hub state from backend.
   */
  static async getHubData(): Promise<OperationsHubResponse> {
    const res = await api.get<any>("/operations/hub");
    return (res?.data || res) as OperationsHubResponse;
  }
}
