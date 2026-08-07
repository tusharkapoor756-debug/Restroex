"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CustomersService } from "../../../lib/services/customers.service";
import { Customer, CustomerDetailsResponse } from "../../../types";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { Sheet } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import {
  Users,
  Search,
  User,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Clock,
  Heart,
  FileText,
  Save,
  Loader2,
  Check
} from "lucide-react";

export default function ProductionCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "high_value" | "repeat">("all");

  // Server-side Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Customer & Deep Details Drawer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetailsResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Editable Notes State
  const [notesInput, setNotesInput] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await CustomersService.listCustomers({
        page,
        limit: 15,
        search: searchQuery.trim() || undefined,
        segment: segmentFilter,
      });
      setCustomers(res.customers);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, segmentFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCustomerSheet = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerDetails(null);
    setIsLoadingDetails(true);
    setNotesSavedSuccess(false);
    try {
      const details = await CustomersService.getCustomerDetails(cust.id);
      setCustomerDetails(details);
      setNotesInput(details.customer.notes || "");
    } catch (err) {
      console.error("Failed to fetch customer details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    setIsSavingNotes(true);
    setNotesSavedSuccess(false);
    try {
      await CustomersService.updateCustomerNotes(selectedCustomer.id, notesInput);
      setNotesSavedSuccess(true);
      if (customerDetails) {
        setCustomerDetails({
          ...customerDetails,
          customer: { ...customerDetails.customer, notes: notesInput },
        });
      }
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleViewOrderDeepLink = (orderUUID: string) => {
    // Navigate to Order History with ?orderId= parameter.
    // Order History page reads this parameter, fetches the order, auto-opens the drawer & highlights the row.
    router.push(`/dashboard/orders/history?orderId=${encodeURIComponent(orderUUID)}`);
  };

  const getCustomerBadge = (c: Customer) => {
    if ((c as any).totalSpent >= 1000 || c.totalSpend >= 1000) return <Badge variant="warning">High Value</Badge>;
    if (c.totalOrders >= 2) return <Badge variant="brand">Repeat</Badge>;
    if (c.totalOrders === 1) return <Badge variant="success">Customer</Badge>;
    return <Badge variant="neutral">New</Badge>;
  };

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amt);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <span>Customer CRM Directory</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Production CRM lifecycle metrics, lifetime spend, order velocity, and customer intelligence.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchCustomers}
          disabled={isLoading}
          className="gap-2 font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Directory</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by customer name or phone..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0 w-full sm:w-auto">
            {(
              [
                { label: "All Customers", value: "all" },
                { label: "High Value (₹1000+)", value: "high_value" },
                { label: "Repeat Customers", value: "repeat" },
              ] as const
            ).map((seg) => (
              <button
                key={seg.value}
                onClick={() => {
                  setSegmentFilter(seg.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  segmentFilter === seg.value
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4 MANDATORY UI STATES */}
      {isError ? (
        <ErrorState title="CRM Directory Fail" message="Could not fetch customer records from server database." onRetry={fetchCustomers} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-brand-600" />}
          title="No Customers Found"
          description="Customer directory records will automatically populate as orders are placed via WhatsApp or Web."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchQuery("");
            setSegmentFilter("all");
          }}
        />
      ) : (
        /* Populated Customer Table */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>CRM Code</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Total Orders</TableHead>
                  <TableHead>Lifetime Spend</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((cust) => (
                  <TableRow
                    key={cust.id}
                    className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    onClick={() => handleOpenCustomerSheet(cust)}
                  >
                    <TableCell className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {cust.name ? cust.name.charAt(0).toUpperCase() : "C"}
                      </div>
                      <span>{cust.name || "WhatsApp Customer"}</span>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-brand-600 dark:text-brand-400 text-xs">
                      {(cust as any).customerCode || <span className="text-slate-400 font-normal">—</span>}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {cust.phone}
                    </TableCell>
                    <TableCell>{getCustomerBadge(cust)}</TableCell>
                    <TableCell className="font-semibold">{cust.totalOrders} Orders</TableCell>
                    <TableCell className="font-heading font-extrabold text-slate-900 dark:text-slate-100">
                      {formatCurrency((cust as any).totalSpent ?? cust.totalSpend)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {cust.lastOrderAt ? new Date(cust.lastOrderAt).toLocaleDateString("en-IN") : "N/A"}
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
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
            <span className="text-slate-500 font-semibold">
              Showing Page {page} of {totalPages} ({totalCount} total customers)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1 font-semibold"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1 font-semibold"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Customer Detail Drawer Modal (5 Complete Operations Sections) */}
      <Sheet
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? `Customer Profile — ${selectedCustomer.name || "Customer"}` : "Customer Profile"}
      >
        {selectedCustomer && (
          <div className="space-y-5 text-xs text-slate-900 dark:text-slate-100">
            {isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="h-8 w-8 text-brand-600 animate-spin" />
                <span className="text-slate-500 font-medium">Loading customer intelligence & LTV data...</span>
              </div>
            ) : customerDetails ? (
              <>
                {/* ── SECTION 1: Customer Summary ────────────────────────────── */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Customer Summary</span>
                      {customerDetails.customer.customerCode && (
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full text-[11px]">
                          {customerDetails.customer.customerCode}
                        </span>
                      )}
                    </div>
                    {getCustomerBadge(selectedCustomer)}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Customer Name</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block">
                        {customerDetails.customer.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Phone Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm block">
                        {customerDetails.customer.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Customer Since</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {new Date(customerDetails.customer.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric", day: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">First Order</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {new Date(customerDetails.metrics.firstOrderDate).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Last Order</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {new Date(customerDetails.metrics.lastOrderDate).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Spend (LTV)</span>
                      <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400 text-sm block">
                        {formatCurrency(customerDetails.metrics.lifetimeSpend)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Orders</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">
                        {customerDetails.metrics.totalOrders} total ({customerDetails.metrics.completedOrders} completed, {customerDetails.metrics.cancelledOrders} cancelled)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Average Order Value (AOV)</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">
                        {formatCurrency(customerDetails.metrics.averageOrderValue)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── SECTION 2: Favourite Items ────────────────────────────── */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <Heart className="h-3.5 w-3.5 text-red-500" />
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Favourite Items (Top 5)</span>
                  </div>
                  <div className="p-4">
                    {customerDetails.favouriteItems.length === 0 ? (
                      <span className="text-slate-400 text-xs">No items ordered yet.</span>
                    ) : (
                      <div className="space-y-2">
                        {customerDetails.favouriteItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                            <span className="font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full text-[11px]">
                              {item.quantity}x ordered
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── SECTION 3: Recent Orders ────────────────────────────── */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <ShoppingBag className="h-3.5 w-3.5 text-brand-500" />
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Recent Orders</span>
                  </div>
                  <div className="p-4">
                    {customerDetails.recentOrders.length === 0 ? (
                      <span className="text-slate-400 text-xs">No order history available.</span>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {customerDetails.recentOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex justify-between items-center"
                          >
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-brand-600 dark:text-brand-400 block">{ord.humanReadableId}</span>
                              <span className="text-slate-500 text-[11px] block">
                                {new Date(ord.date).toLocaleDateString("en-IN", { month: "short", day: "2-digit" })} • <span className="capitalize">{ord.status}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100">{formatCurrency(ord.amount)}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewOrderDeepLink(ord.id)}
                                className="gap-1 text-[11px] px-2.5 py-1"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View Order</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── SECTION 4: Activity & Intelligence ─────────────────────── */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Activity & Intelligence</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Last Seen</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {new Date(customerDetails.activity.lastSeen).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Preferred Order Source</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {customerDetails.activity.preferredSource}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── SECTION 5: Restaurant Notes ────────────────────────────── */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Internal Restaurant Notes</span>
                    </div>
                    {notesSavedSuccess && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Saved
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Add internal notes about customer preferences, allergies, VIP status..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="gap-1.5 font-bold"
                    >
                      {isSavingNotes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>Save Notes</span>
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Sheet>
    </div>
  );
}

