"use client";

import React, { useState, useMemo, useEffect } from "react";
import { CustomersService } from "../../../lib/services/customers.service";
import { Customer } from "../../../types";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import {
  Users,
  Search,
  Phone,
  ShoppingBag,
  User,
  Calendar,
  DollarSign,
  Filter
} from "lucide-react";

export default function ProductionCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "high_value" | "repeat">("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await CustomersService.listCustomers();
      setCustomers(data);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setIsError(true);
    } fontally: {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.phone.includes(searchQuery);

      const matchSegment =
        segmentFilter === "all"
          ? true
          : segmentFilter === "high_value"
          ? c.totalSpend >= 1000
          : c.totalOrders >= 2;

      return matchSearch && matchSegment;
    });
  }, [customers, searchQuery, segmentFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Customer CRM Directory
            </h1>
            <Badge variant="warning" size="sm">
              BACKEND ENDPOINT PENDING
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search customer purchase logs, lifetime spend, and WhatsApp ordering profiles.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
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

      {/* 4 STATES HANDLING MANDATORY IMPLEMENTATION */}
      {isError && (
        <ErrorState title="CRM Directory Fail" message="Could not fetch customer records." onRetry={fetchCustomers} />
      )}

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : customers.length === 0 ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center space-y-4 border-dashed">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500">
            <Users className="h-8 w-8" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="font-heading text-lg font-bold text-slate-900 dark:text-slate-100">
              Customer CRM Endpoint Coming Soon
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Backend API endpoint <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-400 font-mono">/api/v1/customers</code> abhi server me implemented nahi hai. Jab customers WhatsApp par order confirm karenge, unka LTV directory me yahan list hoga.
            </p>
          </div>
          <Badge variant="warning" size="lg">
            Backend Endpoint Missing
          </Badge>
        </Card>
      ) : (
        /* Populated Customer Table */
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Total Orders</TableHead>
              <TableHead>Lifetime Spend</TableHead>
              <TableHead>Last Order Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((cust) => (
              <TableRow key={cust.id} onClick={() => setSelectedCustomer(cust)}>
                <TableCell className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>{cust.name || "WhatsApp Customer"}</span>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-400">{cust.phone}</TableCell>
                <TableCell><Badge variant="brand">{cust.totalOrders} Orders</Badge></TableCell>
                <TableCell className="font-bold text-slate-900 dark:text-slate-100">₹{cust.totalSpend}</TableCell>
                <TableCell className="text-xs text-slate-500">{new Date(cust.lastOrderAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Customer Detail Drawer Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? `Profile: ${selectedCustomer.name || selectedCustomer.phone}` : "Customer Details"}
      >
        {selectedCustomer && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block text-[11px]">Phone Number</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedCustomer.phone}</span>
              </div>
              <Badge variant="success" size="lg">Active Customer</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">TOTAL ORDERS</span>
                <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100 mt-0.5 block">{selectedCustomer.totalOrders}</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-slate-400 block text-[10px]">TOTAL SPENT</span>
                <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100 mt-0.5 block">₹{selectedCustomer.totalSpend}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
