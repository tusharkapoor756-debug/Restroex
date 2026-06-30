// src/app/dashboard/customers/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  User,
  Phone,
  ShoppingBag,
} from "lucide-react";
import { CustomersService } from "../../../lib/services/customers.service";
import { Customer } from "../../../types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const data = await CustomersService.listCustomers();
        setCustomers(data);
        if (data.length > 0) setSelectedCustomerId(data[0].id);
      } catch (error) {
        console.error("Fetch customers error:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const query = searchQuery.toLowerCase();
      return (
        (customer.name && customer.name.toLowerCase().includes(query)) ||
        customer.phone.includes(query)
      );
    });
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Customer CRM</h1>
          <p className="text-slate-400 text-xs mt-0.5">Track purchase history, preferences, and contacts.</p>
        </div>
      </div>

      {/* SEARCH AND CRM CORE SPLIT ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Directory search and list (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search bar */}
          <div className="relative w-full">
            <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0e0f14]/80 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
            />
          </div>

          {/* Customer list container */}
          <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-center py-12 bg-[#0e0f14]/30 border border-[#23242B] rounded-2xl text-slate-500 text-xs">
                Loading customers...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 bg-[#0e0f14]/30 border border-[#23242B] rounded-2xl text-slate-500 text-xs">
                No customer profiles found.
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`border p-4 rounded-xl text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-violet-950/20 border-violet-700/80 shadow-[0_0_15px_rgba(124,58,237,0.08)]"
                        : "bg-[#0e0f14]/50 border-[#23242B] hover:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-200">{cust.name || "Unknown"}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        Last order: {new Date(cust.lastOrderAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <div>
                        <span>{cust.phone}</span>
                        <span className="mx-1.5">•</span>
                        <span>{cust.totalOrders} orders</span>
                      </div>
                      <span className="font-bold text-slate-200">₹{cust.totalSpend} spent</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Profile detail view (7 columns) */}
        <div className="lg:col-span-7 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl min-h-[60vh] overflow-hidden">
          {selectedCustomer ? (
            <div className="p-6 space-y-6">
              {/* Header profile details */}
              <div className="flex items-center gap-4 border-b border-[#23242B]/40 pb-4">
                <div className="w-12 h-12 rounded-xl bg-violet-600/30 border border-violet-500/80 flex items-center justify-center text-lg font-bold text-violet-300">
                  {selectedCustomer.name
                    ? selectedCustomer.name.split(" ").map((n) => n[0]).join("")
                    : "U"}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-sora">
                    {selectedCustomer.name || "Unknown"}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1">
                    ID: {selectedCustomer.id} &bull; Last Order: {new Date(selectedCustomer.lastOrderAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-[#23242B] space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone Number
                  </span>
                  <span className="text-xs text-slate-200 mt-1 font-semibold block">
                    {selectedCustomer.phone}
                  </span>
                </div>
              </div>

              {/* LTV & Statistics Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950/40 border border-[#23242B] rounded-xl text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Total Spent</span>
                  <span className="text-sm font-bold text-white mt-1 block">₹{selectedCustomer.totalSpend}</span>
                </div>
                <div className="p-3 bg-slate-950/40 border border-[#23242B] rounded-xl text-center">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 block">Avg Basket</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    ₹{selectedCustomer.totalOrders
                      ? Math.round(selectedCustomer.totalSpend / selectedCustomer.totalOrders)
                      : 0}
                  </span>
                </div>
              </div>

              {/* Order History - Placeholder */}
              <div className="space-y-3.5 border-t border-[#23242B]/40 pt-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Order History Log
                </h3>
                <div className="bg-slate-950/20 rounded-xl border border-[#23242B] overflow-hidden text-center py-8 text-xs text-slate-500">
                  Order history not yet implemented (API not available).
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 min-h-[50vh] text-slate-500">
              <User className="h-12 w-12 stroke-[1.2] opacity-35 mb-2.5" />
              <p className="text-sm font-semibold">No profile selected</p>
              <p className="text-xs mt-1">Select a customer from the left column to view preference logs and purchases.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
