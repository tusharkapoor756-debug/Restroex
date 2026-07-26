"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { CustomersService } from "../../../lib/services/customers.service";
import { OrdersService } from "../../../lib/services/orders.service";
import { Customer, Order as BackendOrder } from "../../../types";
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
  Phone,
  ShoppingBag,
  User,
  Calendar,
  DollarSign,
  Filter,
  Eye,
  RefreshCw
} from "lucide-react";

export default function ProductionCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "high_value" | "repeat">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Customer Order History for Sheet
  const [customerOrders, setCustomerOrders] = useState<BackendOrder[]>([]);
  const [isLoadingCustomerOrders, setIsLoadingCustomerOrders] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await CustomersService.listCustomers(searchQuery);
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenCustomerSheet = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsLoadingCustomerOrders(true);
    try {
      const res = await OrdersService.getOrderHistory({ search: cust.phone, limit: 50 });
      setCustomerOrders(res.orders || []);
    } catch (err) {
      console.error("Failed to fetch customer orders:", err);
    } finally {
      setIsLoadingCustomerOrders(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSegment =
        segmentFilter === "all"
          ? true
          : segmentFilter === "high_value"
          ? c.totalSpend >= 1000
          : c.totalOrders >= 2;

      return matchSegment;
    });
  }, [customers, segmentFilter]);

  const getCustomerBadge = (c: Customer) => {
    if (c.totalSpend >= 1000) return <Badge variant="warning">High Value</Badge>;
    if (c.totalOrders >= 2) return <Badge variant="brand">Repeat</Badge>;
    return <Badge variant="neutral">New</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <span>Customer CRM Directory</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real database customer LTV, lifetime spend, order count, and purchase history.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchCustomers} className="gap-2 font-semibold self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Directory</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(["all", "high_value", "repeat"] as const).map((seg) => (
            <button
              key={seg}
              onClick={() => setSegmentFilter(seg)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                segmentFilter === seg
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              {seg === "all" ? "All Customers" : seg === "high_value" ? "High Value (₹1000+)" : "Repeat Customers"}
            </button>
          ))}
        </div>
      </div>

      {/* 4 MANDATORY UI STATES */}
      {isError ? (
        <ErrorState title="CRM Directory Fail" message="Could not fetch customer records from database." onRetry={fetchCustomers} />
      ) : isLoading ? (
        <TableSkeleton rows={6} />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-brand-600" />}
          title="No Customers Found"
          description="Customer directory will automatically populate as customers place orders via WhatsApp."
          actionLabel="Clear Search"
          onAction={() => setSearchQuery("")}
        />
      ) : (
        /* Populated Customer Table */
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Total Orders</TableHead>
                <TableHead>Lifetime Spend</TableHead>
                <TableHead>Last Order Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((cust) => (
                <TableRow key={cust.id} className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50" onClick={() => handleOpenCustomerSheet(cust)}>
                  <TableCell className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>{cust.name || "WhatsApp Customer"}</span>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 font-mono">{cust.phone}</TableCell>
                  <TableCell>{getCustomerBadge(cust)}</TableCell>
                  <TableCell className="font-semibold">{cust.totalOrders} Orders</TableCell>
                  <TableCell className="font-heading font-extrabold text-slate-900 dark:text-slate-100">₹{cust.totalSpend}</TableCell>
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
        </Card>
      )}

      {/* Customer Detail Drawer Modal */}
      <Sheet
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? `Profile: ${selectedCustomer.name || selectedCustomer.phone}` : "Customer Details"}
      >
        {selectedCustomer && (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block text-[11px]">Phone Number</span>
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100 text-sm">{selectedCustomer.phone}</span>
              </div>
              {getCustomerBadge(selectedCustomer)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">TOTAL ORDERS</span>
                <span className="font-heading font-extrabold text-lg text-slate-900 dark:text-slate-100 mt-1 block">{selectedCustomer.totalOrders}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">TOTAL SPENT</span>
                <span className="font-heading font-extrabold text-lg text-brand-600 dark:text-brand-400 mt-1 block">₹{selectedCustomer.totalSpend}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Customer Order History</h3>
              {isLoadingCustomerOrders ? (
                <div className="text-center py-6 text-slate-500">Loading order history...</div>
              ) : customerOrders.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No past orders found for this customer.</div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {customerOrders.map((ord) => (
                    <div key={ord.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-brand-600 dark:text-brand-400 block">{ord.humanReadableId || ord.id}</span>
                        <span className="text-slate-500 text-[11px]">{new Date(ord.createdAt).toLocaleDateString()} • {ord.items?.length || 0} items</span>
                      </div>
                      <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100">₹{ord.totalAmount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
