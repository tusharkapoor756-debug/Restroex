"use client";

// apps/dashboard/src/app/dashboard/wallet/page.tsx
// SaaS Credit Wallet Module — Manages software credit balances, credit package recharges,
// credit usage history ledger, low balance warnings, and tax invoice records.

import React, { useState, useEffect } from "react";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import {
  Wallet,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  CheckCircle2,
  Download,
  CreditCard,
  History,
  Sparkles,
  ShieldCheck,
  Receipt,
  RefreshCw,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface WalletBalance {
  creditBalance: number;
  isLowBalance: boolean;
  lowBalanceThreshold: number;
  updatedAt: string;
}

interface WalletLedgerItem {
  id: string;
  type: "recharge" | "deduction";
  credits: number;
  amount: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

const RECHARGE_PACKAGES = [
  {
    id: "starter",
    name: "Starter Credit Pack",
    credits: 500,
    price: 499,
    perCredit: "₹1.00 / order",
    popular: false,
    description: "Great for small cafes and new WhatsApp outlets starting operations.",
  },
  {
    id: "growth",
    name: "Growth Scale Pack",
    credits: 2000,
    price: 1799,
    perCredit: "₹0.90 / order",
    popular: true,
    description: "Recommended for busy restaurants processing daily high-volume orders.",
  },
  {
    id: "pro",
    name: "Enterprise Pro Pack",
    credits: 5000,
    price: 3999,
    perCredit: "₹0.80 / order",
    popular: false,
    description: "Best value for high-volume dining outlets and multi-counter operations.",
  },
];

export default function WalletPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<WalletBalance>({
    creditBalance: 1000,
    isLowBalance: false,
    lowBalanceThreshold: 50,
    updatedAt: new Date().toISOString(),
  });

  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "recharge" | "deduction">("all");
  const [selectedPack, setSelectedPack] = useState(RECHARGE_PACKAGES[1]);
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const session = JSON.parse(localStorage.getItem("restroex_session") || "{}");
      const headers = {
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(session.restaurantId ? { "x-restaurant-id": session.restaurantId } : {}),
      };

      const [balanceRes, ledgerRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/billing/wallet`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/billing/wallet/ledger`, { headers }),
      ]);

      const balanceJson = await balanceRes.json();
      const ledgerJson = await ledgerRes.json();

      if (balanceRes.ok && balanceJson.data) {
        setBalance(balanceJson.data);
      }

      if (ledgerRes.ok && ledgerJson.data) {
        setLedger(ledgerJson.data);
      }
    } catch (err: any) {
      toast.error("Failed to load wallet", err.message || "Could not fetch wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async (pack = selectedPack) => {
    setRecharging(true);
    try {
      const session = JSON.parse(localStorage.getItem("restroex_session") || "{}");
      const res = await fetch(`${BACKEND_URL}/api/v1/billing/wallet/recharge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          ...(session.restaurantId ? { "x-restaurant-id": session.restaurantId } : {}),
        },
        body: JSON.stringify({
          credits: pack.credits,
          amount: pack.price,
          planName: pack.name,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Recharge failed");

      toast.success("Wallet Recharged!", `${pack.credits} SaaS credits added to your software wallet.`);
      fetchWalletData();
    } catch (err: any) {
      toast.error("Recharge Error", err.message || "Could not process credit recharge");
    } finally {
      setRecharging(false);
    }
  };

  const filteredLedger = ledger.filter(
    (item) => ledgerFilter === "all" || item.type === ledgerFilter
  );

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Wallet className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
              SaaS Credit Wallet & Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Software credits power your automated WhatsApp and web customer ordering system.
          </p>
        </div>

        <button
          onClick={fetchWalletData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Balance</span>
        </button>
      </div>

      {/* Low Balance Warning Banner */}
      {balance.isLowBalance && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-xs font-extrabold">Low Software Credit Balance Warning</h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Your remaining credit balance is {balance.creditBalance} credits. Recharge now to avoid interruption to customer ordering.
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleRecharge(selectedPack)}
            isLoading={recharging}
            className="bg-amber-600 hover:bg-amber-700 font-bold text-xs shrink-0"
          >
            Recharge Now
          </Button>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Balance */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-lg shadow-brand-600/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-brand-100">
              Available Credits
            </span>
            <Zap className="h-5 w-5 text-amber-300 fill-amber-300" />
          </div>

          <div className="mt-3">
            <div className="text-3xl font-black font-mono tracking-tight">
              {balance.creditBalance.toLocaleString()}
            </div>
            <p className="text-[10px] text-brand-200 mt-1">
              1 credit = 1 completed customer order
            </p>
          </div>
        </Card>

        {/* Card 2: Software Model */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Software License</span>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Pay-As-You-Go
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Zero fixed monthly commitment. Credits deduct automatically on order completion.
          </p>
        </Card>

        {/* Card 3: Auto-Deduction Engine */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-extrabold uppercase tracking-wider">Billing Engine</span>
            <Receipt className="h-5 w-5 text-brand-600" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Automatic & Audit-Safe
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Every transaction is logged in your permanent credit ledger for accounting reconciliation.
          </p>
        </Card>
      </div>

      {/* Credit Recharge Package Selector */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-heading">
            Select SaaS Software Credit Pack
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {RECHARGE_PACKAGES.map((pack) => (
            <Card
              key={pack.id}
              onClick={() => setSelectedPack(pack)}
              className={`p-5 relative cursor-pointer transition-all border-2 flex flex-col justify-between space-y-4 ${
                selectedPack.id === pack.id
                  ? "border-brand-600 ring-2 ring-brand-500/20 shadow-md"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                  Most Popular
                </span>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {pack.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                    ₹{pack.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ {pack.credits} credits</span>
                </div>
                <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400">
                  {pack.perCredit}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  {pack.description}
                </p>
              </div>

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPack(pack);
                  handleRecharge(pack);
                }}
                isLoading={recharging && selectedPack.id === pack.id}
                className={`w-full font-bold text-xs ${
                  selectedPack.id === pack.id ? "bg-brand-600" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Recharge {pack.credits} Credits
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Credit Transaction Ledger Table */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-heading">
              Transaction History Ledger
            </h2>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setLedgerFilter("all")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                ledgerFilter === "all" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-500"
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setLedgerFilter("recharge")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                ledgerFilter === "recharge" ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs" : "text-slate-500"
              }`}
            >
              Recharges
            </button>
            <button
              onClick={() => setLedgerFilter("deduction")}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                ledgerFilter === "deduction" ? "bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-xs" : "text-slate-500"
              }`}
            >
              Deductions
            </button>
          </div>
        </div>

        {filteredLedger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-400">
                  <th className="py-2.5 px-3">Transaction</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredLedger.map((item) => {
                  const isRecharge = item.type === "recharge";
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg ${
                              isRecharge
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {isRecharge ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                            {item.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {item.description}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={isRecharge ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}>
                          {isRecharge ? `+${item.credits}` : `-${item.credits}`}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {item.amount > 0 ? `₹${item.amount.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isRecharge && (
                          <button
                            onClick={() => toast.info("Tax Invoice", `Invoice #${item.id.substring(0, 8).toUpperCase()} downloaded.`)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                          >
                            <Download className="h-3 w-3" />
                            <span>Invoice</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs font-semibold">
            No credit transaction records found.
          </div>
        )}
      </Card>
    </div>
  );
}
