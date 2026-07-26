"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

  // Selected Order for Slide-Over Sheet
  const [selectedOrder, setSelectedOrder] = useState<BackendOrder | null>(null);

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
              {orders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50" onClick={() => setSelectedOrder(order)}>
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
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
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

      {/* Order Detail Slide-Over Drawer */}
      <Sheet
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={`Order Ticket: ${selectedOrder?.humanReadableId || selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="font-semibold text-slate-500">Current Status</span>
              {getStatusBadge(selectedOrder.status)}
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">Item Breakdown</span>
              <div className="space-y-2">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.name || item.variantName}</span>
                      <span className="text-slate-500 text-[11px]">Qty: {item.quantity} x ₹{item.unitPrice}</span>
                    </div>
                    <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100">
                      ₹{item.totalPrice}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{selectedOrder.totalAmount}</span>
              </div>
              <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-800 pt-2 text-sm">
                <span>Total Amount:</span>
                <span>₹{selectedOrder.totalAmount}</span>
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
