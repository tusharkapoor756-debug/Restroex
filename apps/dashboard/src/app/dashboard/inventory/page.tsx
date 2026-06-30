// src/app/dashboard/inventory/page.tsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Boxes,
  Truck,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  X,
} from "lucide-react";
import { InventoryService } from "../../../lib/services/inventory.service";
import { InventoryItem } from "../../../types";

type Tab = "stock" | "suppliers" | "po";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [stock, setStock] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await InventoryService.listInventory();
        setStock(data);
      } catch (error) {
        console.error("Failed to load inventory:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filteredStock = useMemo(() => {
    return stock.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stock, searchQuery]);

  const lowStockCount = useMemo(() => stock.filter((item) => item.isLow).length, [stock]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Inventory &amp; Procurement</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage ingredient stock levels, low alerts, suppliers, and purchase orders.
          </p>
        </div>
      </div>

      {/* SEGMENT TABS SWITCHER */}
      <div className="flex border-b border-[#23242B]/60 pb-px">
        <button
          onClick={() => { setActiveTab("stock"); setSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-bold transition-all relative ${
            activeTab === "stock" ? "text-violet-400 border-b-2 border-violet-500 font-semibold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Stock Levels
            {lowStockCount > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-red-950 text-red-400 border border-red-900 text-[9px] font-bold flex items-center justify-center">
                {lowStockCount} alert
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("suppliers"); setSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-bold transition-all relative ${
            activeTab === "suppliers" ? "text-violet-400 border-b-2 border-violet-500 font-semibold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> Suppliers
          </span>
        </button>

        <button
          onClick={() => { setActiveTab("po"); setSearchQuery(""); }}
          className={`px-4 py-2 text-xs font-bold transition-all relative ${
            activeTab === "po" ? "text-violet-400 border-b-2 border-violet-500 font-semibold" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="flex items-center gap-2">
            Purchase Orders
          </span>
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="mt-6">
        {/* === STOCK LIST === */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="relative w-full sm:w-80">
              <Search className="h-4.5 w-4.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search inventory items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0e0f14]/80 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
              />
            </div>

            <div className="bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl overflow-hidden">
              {filteredStock.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {isLoading ? "Loading..." : "No inventory items found."}
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#23242B] bg-[#0e0f14]/80 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Stock Level</th>
                      <th className="p-4">Threshold</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23242B]/40 text-xs">
                    {filteredStock.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-slate-200">{item.name}</span>
                        </td>
                        <td className="p-4 font-semibold text-slate-300">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {item.minimumThreshold} {item.unit}
                        </td>
                        <td className="p-4 text-center">
                          {item.isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/40 text-red-400 font-bold border border-red-900/60">
                              <AlertTriangle className="h-3 w-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-400 font-bold border border-emerald-900/60">
                              <CheckCircle2 className="h-3 w-3" /> Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* === SUPPLIERS (placeholder) === */}
        {activeTab === "suppliers" && (
          <div className="text-center py-12 text-slate-500 text-xs bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl">
            Suppliers integration not implemented (API not available yet)
          </div>
        )}

        {/* === PURCHASE ORDERS (placeholder) === */}
        {activeTab === "po" && (
          <div className="text-center py-12 text-slate-500 text-xs bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl">
            Purchase Orders integration not implemented (API not available yet)
          </div>
        )}
      </div>
    </div>
  );
}
