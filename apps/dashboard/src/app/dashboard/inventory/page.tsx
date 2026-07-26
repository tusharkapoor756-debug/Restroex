"use client";

import React, { useState, useEffect } from "react";
import { Search, Package, AlertTriangle, RefreshCw } from "lucide-react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/Table";
import { Input } from "../../../components/ui/Input";
import { EmptyState } from "../../../components/ui/StateViews";

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  minimumThreshold: number;
  unit: string;
  status: "ok" | "low" | "critical";
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"stock" | "vendors">("stock");
  const [searchQuery, setSearchQuery] = useState("");
  const [stockItems, setStockItems] = useState<InventoryItem[]>([
    { id: "1", name: "Paneer (Fresh Cottage Cheese)", currentStock: 8.5, minimumThreshold: 3.0, unit: "kg", status: "ok" },
    { id: "2", name: "Fresh Mint Leaves", currentStock: 0.3, minimumThreshold: 0.5, unit: "kg", status: "critical" },
    { id: "3", name: "Butter (Unsalted)", currentStock: 2.1, minimumThreshold: 2.0, unit: "kg", status: "low" },
    { id: "4", name: "Basmati Rice", currentStock: 45.0, minimumThreshold: 10.0, unit: "kg", status: "ok" },
  ]);

  const filteredStock = stockItems.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <span>Raw Material & Stock Inventory</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track ingredient stock levels, low-supply alerts, and vendor purchasing thresholds.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "stock"
              ? "bg-white dark:bg-slate-900 border-x border-t border-slate-200/80 dark:border-slate-800 text-brand-600 dark:text-brand-400"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Ingredient Stock Levels
        </button>
        <button
          onClick={() => setActiveTab("vendors")}
          className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "vendors"
              ? "bg-white dark:bg-slate-900 border-x border-t border-slate-200/80 dark:border-slate-800 text-brand-600 dark:text-brand-400"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Suppliers & Vendors
        </button>
      </div>

      {activeTab === "stock" ? (
        <div className="space-y-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search raw ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient Name</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Minimum Threshold</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold text-slate-900 dark:text-slate-100">{item.name}</TableCell>
                    <TableCell className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.currentStock} {item.unit}
                    </TableCell>
                    <TableCell className="text-slate-500">{item.minimumThreshold} {item.unit}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={item.status === "ok" ? "success" : item.status === "low" ? "warning" : "danger"}>
                        {item.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      ) : (
        <EmptyState
          icon={<Package className="h-8 w-8 text-brand-600" />}
          title="Supplier Management"
          description="Supplier directory integration pending."
        />
      )}
    </div>
  );
}
