"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OrdersService } from "../../../../lib/services/orders.service";
import { Order as BackendOrder } from "../../../../types";
import { useToast } from "../../../../components/ui/ToastContainer";
import Button from "../../../../components/ui/Button";
import Badge from "../../../../components/ui/Badge";
import Card from "../../../../components/ui/Card";
import Skeleton, { TableSkeleton } from "../../../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../../../components/ui/StateViews";
import { Sheet } from "../../../../components/ui/Modal";
import { Input, Select } from "../../../../components/ui/Input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../../../components/ui/Table";
import {
  Search,
  History,
  Calendar,
  Filter,
  Eye,
  RefreshCw,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Printer,
  CheckCircle2
} from "lucide-react";

export default function ProductionOrderHistoryPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Selected Order for Slide-Over Sheet
  const [selectedOrder, setSelectedOrder] = useState<BackendOrder | null>(null);

  // ── Sync URL query param `?orderId=` <-> `selectedOrder` state ──
  const activeOrderId = searchParams.get("orderId");

  // Helper to open an order and push/replace URL parameter without losing page history
  const handleSelectOrder = useCallback(
    (order: BackendOrder | null) => {
      setSelectedOrder(order);
      const params = new URLSearchParams(window.location.search);
      if (order) {
        if (params.get("orderId") !== order.id) {
          params.set("orderId", order.id);
          router.push(`?${params.toString()}`, { scroll: false });
        }
      } else {
        if (params.has("orderId")) {
          params.delete("orderId");
          const queryString = params.toString();
          router.push(queryString ? `?${queryString}` : window.location.pathname, { scroll: false });
        }
      }
    },
    [router]
  );

  // When `activeOrderId` in URL changes (mount, refresh, back/forward navigation), fetch and select order
  useEffect(() => {
    if (!activeOrderId) {
      setSelectedOrder(null);
      return;
    }

    // If order is already in state, just set it
    const existing = orders.find((o) => o.id === activeOrderId);
    if (existing) {
      setSelectedOrder(existing);
      return;
    }

    // Otherwise fetch the specific order from backend (works even if order is on page 5 or filtered out)
    OrdersService.getOrderById(activeOrderId)
      .then((order) => {
        if (order) setSelectedOrder(order);
      })
      .catch((err) => {
        console.error("[OrderHistory] Deep-link order fetch failed:", err);
      });
  }, [activeOrderId, orders]);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await OrdersService.getOrderHistory({
        page,
        limit: 15,
        search: searchQuery,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setOrders(res.orders);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err) {
      console.error("Failed to fetch order history:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return <Badge variant="success">{status.toUpperCase()}</Badge>;
      case "preparing":
      case "accepted":
        return <Badge variant="warning">{status.toUpperCase()}</Badge>;
      case "cancelled":
        return <Badge variant="danger">CANCELLED</Badge>;
      default:
        return <Badge variant="info">{status.toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <span>Order History & Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search completed, cancelled, and past restaurant tickets from database records.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchHistory} className="gap-2 self-start sm:self-auto font-semibold">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Records</span>
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search by Order ID (e.g. ORD-1001) or Phone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 justify-end">
            <span>Total Orders Found:</span>
            <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm">
              {totalCount}
            </span>
          </div>
        </div>
      </Card>

      {/* 4 MANDATORY UI STATES */}
      {isError ? (
        <ErrorState title="History Load Error" message="Failed to fetch past order records from server database." onRetry={fetchHistory} />
      ) : isLoading ? (
        <TableSkeleton rows={8} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8 text-brand-600" />}
          title="No Past Orders Found"
          description="Order history records will automatically populate here as orders are placed and completed."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery("");
            setStatusFilter("all");
          }}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items Count</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                return (
                  <TableRow
                    key={order.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-brand-50/80 dark:bg-brand-950/40 border-l-4 border-l-brand-600 dark:border-l-brand-400"
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    }`}
                    onClick={() => handleSelectOrder(order)}
                  >
                    <TableCell className="font-mono font-bold text-brand-600 dark:text-brand-400">
                      {order.humanReadableId || order.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {order.customerName || "WhatsApp Customer"}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {order.customerPhone}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {order.items?.length || 0} Items
                    </TableCell>
                    <TableCell className="font-heading font-extrabold text-slate-900 dark:text-slate-100">
                      ₹{order.totalAmount || 0}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-slate-500 text-xs">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="p-1.5 text-slate-500">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
            <span className="text-slate-500 font-semibold">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Order Detail Slide-Over Drawer (Polished MVP Operations) */}
      <Sheet
        isOpen={Boolean(selectedOrder)}
        onClose={() => handleSelectOrder(null)}
        title={`Order Details — ${selectedOrder?.humanReadableId || selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="space-y-5 text-xs text-slate-900 dark:text-slate-100">
            {/* SECTION 1: Order Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Order Summary</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 block text-[11px]">Order ID</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {selectedOrder.humanReadableId || selectedOrder.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Created Date & Time</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }) +
                        " • " +
                        new Date(selectedOrder.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2: Customer Details */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Customer Details</span>
              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div>
                  <span className="text-slate-500 block text-[11px]">Customer Name</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedOrder.customerName || "Walk-in Guest"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Phone Number</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {selectedOrder.customerContactPhone || selectedOrder.customerPhone || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION: Special Instructions (Shown ONLY if present) */}
            {(selectedOrder.notes || selectedOrder.instructions) && (
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] block">
                  Special Instructions
                </span>
                <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                  {selectedOrder.notes || selectedOrder.instructions}
                </p>
              </div>
            )}

            {/* SECTION 3: Ordered Items */}
            <div className="space-y-2.5">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                Ordered Items ({selectedOrder.items?.length || 0})
              </span>
              <div className="space-y-2.5">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item: any, idx: number) => {
                    const itemName = item.itemNameSnapshot || item.name || "Menu Item";
                    const variant = item.variantNameSnapshot || item.variantName;
                    const qty = item.quantity || 1;
                    const unitPrice = item.unitPrice || 0;
                    const itemTotal = item.totalPrice || qty * unitPrice;
                    const itemNote = item.notes || item.instructions;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {itemName}
                            </p>
                            {variant && (
                              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Variant: <span className="text-slate-700 dark:text-slate-300 font-semibold">{variant}</span>
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block font-medium">Item Total</span>
                            <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                              ₹{itemTotal}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800 text-slate-500">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Qty</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{qty}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Unit Price</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">₹{unitPrice}</span>
                          </div>
                        </div>

                        {itemNote && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                            Note: {itemNote}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 text-center">
                    No items found for this order.
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 4: Price Summary */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">Price Breakdown</span>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {selectedOrder.subtotal !== undefined && selectedOrder.subtotal > 0 && (
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">₹{selectedOrder.subtotal}</span>
                  </div>
                )}
                {selectedOrder.discountAmount !== undefined && selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-medium">-₹{selectedOrder.discountAmount}</span>
                  </div>
                )}
                {selectedOrder.tax !== undefined && selectedOrder.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Taxes & GST</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">₹{selectedOrder.tax}</span>
                  </div>
                )}
                {selectedOrder.packingCharge !== undefined && selectedOrder.packingCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Packaging Charge</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">₹{selectedOrder.packingCharge}</span>
                  </div>
                )}
                {selectedOrder.deliveryCharge !== undefined && selectedOrder.deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charge</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">₹{selectedOrder.deliveryCharge}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span>Grand Total</span>
                  <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400 text-base">
                    ₹{selectedOrder.totalAmount || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 5 & SECTION 6: Payment & Order Source */}
            <div className="grid grid-cols-2 gap-3">
              {/* Payment Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment</span>
                <div>
                  <span className="text-[10px] text-slate-500 block">Payment Status</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {selectedOrder.payment?.paymentStatus || (selectedOrder.status === 'completed' || selectedOrder.status === 'paid' ? 'Verified' : selectedOrder.status === 'cancelled' ? 'Refunded' : 'Pending')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Payment Method</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                    {selectedOrder.payment?.paymentMethod ? selectedOrder.payment.paymentMethod.replace(/_/g, ' ') : 'UPI'}
                  </span>
                </div>
              </div>

              {/* Order Source Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Order Origin</span>
                <div>
                  <span className="text-[10px] text-slate-500 block">Order Source</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {selectedOrder.source || 'WhatsApp'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Order Type</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                    {selectedOrder.orderType ? selectedOrder.orderType : 'Takeaway'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
