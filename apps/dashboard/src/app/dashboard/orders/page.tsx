// src/app/dashboard/orders/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  ShoppingBag,
  MessageSquare,
  Utensils,
  ChevronRight,
  Clock,
  Printer,
  XCircle,
  CheckCircle2,
  Calendar,
  User,
  AlertCircle,
  Phone
} from "lucide-react";
import { OrdersService } from "../../../lib/services/orders.service";
import { Order as BackendOrder, WorkflowOrderStatus } from "../../../types";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface UiOrder {
  id: string;
  backendId: string;
  source: "whatsapp" | "table";
  customerName?: string;
  customerPhone?: string;
  tableNo?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: WorkflowOrderStatus | "checkout_pending" | "paid" | "cart_active" | "payment_pending" | "refunded";
  createdAt: string;
  timeline: { status: string; time: string; description: string }[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<UiOrder | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "whatsapp" | "table">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchOrders = async () => {
    try {
      const data = await OrdersService.getActiveOrders();
      const mapped: UiOrder[] = data.map((o) => {
        const timeNow = new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          id: o.humanReadableId || o.id.substring(0, 8),
          backendId: o.id,
          source: "whatsapp",
          customerPhone: o.customerPhone,
          items: o.items?.map(i => ({ name: i.itemNameSnapshot, quantity: i.quantity, price: i.unitPrice })) || [],
          subtotal: o.totalAmount, // Mocking tax/discount as 0 for simplicity if not provided
          tax: 0,
          discount: 0,
          total: o.totalAmount,
          status: o.status,
          createdAt: timeNow,
          timeline: [
            { status: "Received", time: timeNow, description: "Order parsed and generated." }
          ]
        };
      });
      setOrders(mapped);
      if (mapped.length > 0 && !selectedOrder) {
        setSelectedOrder(mapped[0]);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filters logic
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.tableNo && order.tableNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.customerPhone && order.customerPhone.includes(searchQuery)) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSource = sourceFilter === "all" || order.source === sourceFilter;
      const matchStatus = statusFilter === "all" || order.status === statusFilter;

      return matchSearch && matchSource && matchStatus;
    });
  }, [orders, searchQuery, sourceFilter, statusFilter]);

  // Handle status update
  const handleUpdateStatus = async (backendId: string, id: string, nextStatus: WorkflowOrderStatus) => {
    try {
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusTextMap: Record<string, string> = {
        accepted: "Kitchen accepted ticket.",
        preparing: "Kitchen accepted ticket and started cooking.",
        ready: "Kitchen marked order as ready to serve.",
        completed: "Order marked as delivered and settled.",
        cancelled: "Order cancelled by admin operator."
      };

      // Optimistic Update
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id === id) {
            const updatedTimeline = [
              ...order.timeline,
              {
                status: nextStatus.replace(/^\w/, (c) => c.toUpperCase()),
                time: timeNow,
                description: statusTextMap[nextStatus] || "Status updated."
              }
            ];
            const updatedOrder = { ...order, status: nextStatus, timeline: updatedTimeline };
            // Keep selection synchronized
            if (selectedOrder && selectedOrder.id === id) {
              setSelectedOrder(updatedOrder);
            }
            return updatedOrder;
          }
          return order;
        })
      );

      await OrdersService.transitionOrder(backendId, nextStatus);
    } catch (error) {
      console.error("Status update failed:", error);
      fetchOrders();
    }
  };

  // Badge styler
  const getStatusBadge = (status: UiOrder["status"]) => {
    if (status === "paid" || status === "accepted" || status === "checkout_pending" || status === "cart_active" || status === "payment_pending") {
      return "bg-violet-950 text-violet-300 border border-violet-800 animate-pulse";
    }
    switch (status) {
      case "preparing":
        return "bg-amber-950 text-amber-300 border border-amber-800";
      case "ready":
        return "bg-emerald-950 text-emerald-300 border border-emerald-800";
      case "completed":
        return "bg-slate-900 text-slate-400 border border-slate-800";
      case "cancelled":
        return "bg-red-950 text-red-300 border border-red-900";
      default:
        return "bg-slate-900 text-slate-400 border border-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Live Orders Manager</h1>
          <p className="text-slate-400 text-xs mt-0.5">Filter, monitor, and print receipts for kitchen orders.</p>
        </div>
      </div>

      {/* FILTER BAR ROW */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#0e0f14]/80 p-4 border border-[#23242B] rounded-2xl">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="h-4.5 w-4.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Order ID, table, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full sm:w-auto justify-end overflow-x-auto">
          {/* Source filters */}
          <select
            value={sourceFilter}
            onChange={(e: any) => setSourceFilter(e.target.value)}
            className="bg-slate-950 border border-[#23242B] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Sources</option>
            <option value="whatsapp">WhatsApp Only</option>
            <option value="table">Table QR Only</option>
          </select>

          {/* Status filters */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-[#23242B] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* CORE SPLIT WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Panel: Orders List (12-col layout: 5 cols width) */}
        <div className="lg:col-span-5 space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-[#0e0f14]/30 rounded-2xl border border-[#23242B] text-slate-500 text-xs">
              No orders matched your active filters.
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedOrder && selectedOrder.id === order.id;

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`border p-4 rounded-xl text-left cursor-pointer transition-all ${
                    isSelected
                      ? "bg-violet-950/20 border-violet-700/80 shadow-[0_0_15px_rgba(124,58,237,0.08)]"
                      : "bg-[#0e0f14]/50 border-[#23242B] hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{order.id}</span>
                      <span className="text-[10px] text-slate-500">{order.createdAt}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-300 font-medium">
                        {order.source === "table" ? (
                          <span className="flex items-center gap-1">
                            <Utensils className="h-3 w-3 text-slate-500" />
                            {order.tableNo}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-emerald-500" />
                            {order.customerName || order.customerPhone}
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        {order.items.reduce((total, item) => total + item.quantity, 0)} items
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-white">₹{order.total}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side Panel: selected Order Details (7 cols width) */}
        <div className="lg:col-span-7 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl overflow-hidden min-h-[60vh]">
          {selectedOrder ? (
            <div className="p-6 space-y-6">
              
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#23242B]/40 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-white font-sora">{selectedOrder.id}</h2>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Placed on {selectedOrder.createdAt}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 border border-[#23242B] hover:bg-slate-900 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">
                    <Printer className="h-4 w-4" />
                    Print KOT
                  </button>
                </div>
              </div>

              {/* Customer / Source Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-[#23242B] space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Order Source</span>
                  <div className="flex items-center gap-2 text-xs text-slate-200 mt-1 font-medium">
                    {selectedOrder.source === "whatsapp" ? (
                      <>
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                        <span>WhatsApp Automation</span>
                      </>
                    ) : (
                      <>
                        <Utensils className="h-4 w-4 text-violet-400" />
                        <span>Dine-In QR Menu</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-[#23242B] space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    {selectedOrder.source === "whatsapp" ? "Customer Details" : "Table Details"}
                  </span>
                  <div className="text-xs text-slate-200 mt-1 space-y-0.5 font-medium">
                    {selectedOrder.source === "whatsapp" ? (
                      <>
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-500" /> {selectedOrder.customerName}</div>
                        <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-500" /> {selectedOrder.customerPhone}</div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5"><Utensils className="h-3 w-3 text-slate-500" /> {selectedOrder.tableNo}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Items</h3>
                <div className="bg-slate-950/40 rounded-xl border border-[#23242B] p-4 divide-y divide-[#23242B]/30">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0 text-xs">
                      <div>
                        <span className="font-bold text-slate-200">{item.quantity}x</span>
                        <span className="text-slate-300 ml-2 font-medium">{item.name}</span>
                      </div>
                      <span className="text-slate-200 font-semibold">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Calculation */}
              <div className="bg-slate-950/20 border border-[#23242B] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{selectedOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax (5% GST)</span>
                  <span>₹{selectedOrder.tax}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-400 font-medium">
                    <span>Discount code</span>
                    <span>-₹{selectedOrder.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white border-t border-[#23242B]/40 pt-2.5 mt-1.5">
                  <span>Total Amount</span>
                  <span>₹{selectedOrder.total}</span>
                </div>
              </div>

              {/* Actions panel */}
              {selectedOrder.status !== "completed" && selectedOrder.status !== "cancelled" && (
                <div className="flex flex-wrap gap-2.5 border-t border-[#23242B]/40 pt-5">
                  {(selectedOrder.status === "paid" || selectedOrder.status === "accepted" || selectedOrder.status === "checkout_pending" || selectedOrder.status === "payment_pending" || selectedOrder.status === "cart_active") && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.backendId, selectedOrder.id, "preparing")}
                      className="flex-1 min-w-[120px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-2.5 text-xs font-semibold transition-all active:scale-[0.98]"
                    >
                      Accept Order
                    </button>
                  )}
                  {selectedOrder.status === "preparing" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.backendId, selectedOrder.id, "ready")}
                      className="flex-1 min-w-[120px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white py-2.5 text-xs font-semibold transition-all active:scale-[0.98]"
                    >
                      Mark Ready to Serve
                    </button>
                  )}
                  {selectedOrder.status === "ready" && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.backendId, selectedOrder.id, "completed")}
                      className="flex-1 min-w-[120px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-xs font-semibold transition-all active:scale-[0.98]"
                    >
                      Mark Served & Closed
                    </button>
                  )}

                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.backendId, selectedOrder.id, "cancelled")}
                    className="flex-1 min-w-[120px] rounded-xl border border-red-900/60 text-red-300 hover:bg-red-950/20 py-2.5 text-xs font-semibold transition-all"
                  >
                    Cancel Order
                  </button>
                </div>
              )}

              {/* Order Status Timeline details */}
              <div className="space-y-4 border-t border-[#23242B]/40 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Order Progress Timeline</h3>
                
                <div className="space-y-4">
                  {selectedOrder.timeline.map((step, idx) => (
                    <div key={idx} className="flex gap-3 text-xs relative">
                      {/* Timeline node connector */}
                      {idx < selectedOrder.timeline.length - 1 && (
                        <div className="absolute left-2.5 top-6 bottom-0 w-px bg-slate-800" />
                      )}
                      
                      <div className="h-5.5 w-5.5 rounded-full bg-[#0e0f14] border border-violet-500/80 flex items-center justify-center shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{step.status}</span>
                          <span className="text-[10px] text-slate-500">{step.time}</span>
                        </div>
                        <p className="text-slate-400 text-xs leading-normal">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[50vh] text-slate-500">
              <ShoppingBag className="h-12 w-12 stroke-[1.2] opacity-35 mb-2.5" />
              <p className="text-sm font-semibold">No order selected</p>
              <p className="text-xs mt-1">Select an order from the list on the left to view timeline & details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
