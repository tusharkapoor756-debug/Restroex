"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Eye,
  Phone,
  IndianRupee,
  AlertTriangle,
  Shield,
  ChevronDown,
  X,
  Loader2,
  BadgeCheck,
  Ban,
  ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PaymentsService } from "../../../lib/services/payments.service";
import { Payment, PaymentStatus } from "../../../types";
import { getRestaurantSession } from "../../../lib/auth";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Sheet } from "../../../components/ui/Modal";

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border border-amber-400/20",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  screenshot_uploaded: {
    label: "Screenshot Uploaded",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border border-blue-400/20",
    icon: <Upload className="w-3.5 h-3.5" />,
  },
  pending_verification: {
    label: "Awaiting Verification",
    color: "text-violet-400",
    bg: "bg-violet-400/10 border border-violet-400/20",
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  verified: {
    label: "Verified",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border border-emerald-400/20",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bg: "bg-red-400/10 border border-red-400/20",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  failed: {
    label: "Failed",
    color: "text-red-500",
    bg: "bg-red-500/10 border border-red-500/20",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  refunded: {
    label: "Refunded",
    color: "text-slate-400",
    bg: "bg-slate-400/10 border border-slate-400/20",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
  },
  expired: {
    label: "Expired",
    color: "text-slate-500",
    bg: "bg-slate-500/10 border border-slate-500/20",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "text-slate-400",
    bg: "bg-slate-400/10 border border-slate-400/20",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Payment Details Drawer (MVP Gateway Audit) ────────────────────────────────

interface PaymentDetailsDrawerProps {
  payment: Payment;
  onClose: () => void;
  onOpenOrder: (orderId: string) => void;
}

// Helper: format a full datetime string for display
function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return "N/A";
  return (
    new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

// Helper: format time only
function formatTime(ts: string | null | undefined): string {
  if (!ts) return "N/A";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Helper: capitalise + replace underscores
function humanise(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Subcomponent: a single labelled field row
function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// Subcomponent: a gateway data row (label left, value right)
function GatewayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 text-right break-all">
        {value}
      </span>
    </div>
  );
}

function PaymentDetailsDrawer({ payment, onClose, onOpenOrder }: PaymentDetailsDrawerProps) {
  const statusStr = String(payment.paymentStatus);
  const isPaid =
    statusStr === "verified" ||
    statusStr === "captured" ||
    statusStr === "paid";
  const isFailed = payment.paymentStatus === "failed" || payment.paymentStatus === "rejected";
  const isRefunded = payment.paymentStatus === "refunded";

  // ── Resolve display values ──────────────────────────────────────────────────

  // Human-readable order ID: prefer enriched field, never show raw UUID
  const displayOrderId = payment.orderHumanReadableId || "—";

  // Order status from enriched JOIN
  const displayOrderStatus = payment.orderStatus ? humanise(payment.orderStatus) : "—";

  // Customer name
  const displayCustomerName = payment.customerName || "—";

  // Customer phone: prefer enriched field (real phone from orders/customers table).
  // NEVER display WhatsApp LID (contains @lid).
  const rawPhone = payment.customerContactPhone || payment.customerPhone || "";
  const isLid = rawPhone.includes("@lid") || rawPhone.includes("@s.whatsapp");
  const displayPhone = isLid ? "Not Available" : rawPhone || "Not Available";

  // ── Gateway data (only provider-origin IDs) ─────────────────────────────────
  const gd = (payment.gatewayData as Record<string, any>) ?? {};
  const providerNameLower = (payment.providerName || "").toLowerCase();
  const isRazorpay = providerNameLower.includes("razorpay");

  // Dynamic labels based on gateway provider
  const gatewayOrderLabel = isRazorpay ? "Razorpay Order ID" : "Gateway Order ID";
  const gatewayPaymentLabel = isRazorpay ? "Razorpay Payment ID" : "Gateway Payment ID";

  // Universal provider resolution (columns or gatewayData JSONB)
  const gatewayOrderId =
    payment.providerOrderId ||
    gd.orderId ||
    gd.razorpay_order_id ||
    gd.cf_order_id ||
    gd.merchantOrderId ||
    "Not Available";

  const gatewayPaymentId =
    payment.providerTransactionId ||
    gd.paymentId ||
    gd.razorpay_payment_id ||
    gd.cf_payment_id ||
    gd.transactionId ||
    "Not Available";

  const gatewayUtr =
    gd.utr ||
    gd.bank_reference ||
    gd.acquirer_data?.upi_transaction_id ||
    payment.verifiedTransactionReference ||
    "Not Available";

  const gatewayName = humanise(payment.providerName) || "Not Available";

  return (
    <Sheet
      isOpen={Boolean(payment)}
      onClose={onClose}
      title={`Payment Details — ${payment.orderHumanReadableId || "Payment"}`}
    >
      <div className="space-y-5 text-xs text-slate-900 dark:text-slate-100">

        {/* ── SECTION 1: Payment Summary ────────────────────────────────────── */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Payment Summary</span>
            <StatusBadge status={payment.paymentStatus} />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
            <InfoRow
              label="Amount"
              value={
                <span className="text-base font-extrabold text-brand-600 dark:text-brand-400">
                  {formatAmount(payment.amount)}
                </span>
              }
            />
            <InfoRow label="Payment Method" value={humanise(payment.paymentMethod) || "UPI Gateway"} />
            <InfoRow label="Gateway" value={humanise(payment.providerName) || "—"} />
            <InfoRow label="Created At" value={formatDateTime(payment.createdAt)} />
            {payment.completedAt && (
              <InfoRow label="Completed At" value={formatDateTime(payment.completedAt)} />
            )}
          </div>
        </div>

        {/* ── SECTION 2: Linked Order ───────────────────────────────────────── */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Linked Order</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenOrder(payment.orderId)}
              className="gap-1.5 font-bold text-xs"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View Order</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 p-4">
            <InfoRow label="Restroex Order ID" value={displayOrderId} mono />
            <InfoRow label="Order Status" value={displayOrderStatus} />
            <InfoRow label="Customer Name" value={displayCustomerName} />
            <InfoRow label="Customer Phone" value={displayPhone} mono />
          </div>
        </div>

        {/* ── SECTION 3: Gateway Transaction Details (Always visible, strict provider IDs) ─────── */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Gateway Transaction Details</span>
          </div>
          <div className="px-4 py-2">
            <GatewayRow label="Gateway" value={gatewayName} />
            <GatewayRow label={gatewayOrderLabel} value={gatewayOrderId} />
            <GatewayRow label={gatewayPaymentLabel} value={gatewayPaymentId} />
            <GatewayRow label="UTR / Bank Reference" value={gatewayUtr} />
          </div>
        </div>

        {/* ── SECTION 4: Payment Timeline ──────────────────────────────────── */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-4 pt-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Payment Timeline</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex items-center gap-2.5 text-[11px]">
              <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />
              <span className="text-slate-500 font-medium">Initiated:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatTime(payment.createdAt)}</span>
            </div>
            {isPaid && (
              <div className="flex items-center gap-2.5 text-[11px]">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-500 font-medium">Captured:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {payment.completedAt ? formatTime(payment.completedAt) : payment.verifiedAt ? formatTime(payment.verifiedAt) : "Confirmed"}
                </span>
              </div>
            )}
            {isFailed && (
              <div className="flex items-center gap-2.5 text-[11px]">
                <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-slate-500 font-medium">Failed:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {payment.failureReason || "Gateway Declined"}
                </span>
              </div>
            )}
            {isRefunded && (
              <div className="flex items-center gap-2.5 text-[11px]">
                <div className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <span className="text-slate-500 font-medium">Refunded:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Refund Processed</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ─── Main Payments Page (MVP Read-Only Gateway Audit) ──────────────────────────

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "verified" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

export default function PaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const session = getRestaurantSession();
    if (session?.id) setRestaurantId(session.id);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await PaymentsService.getPaymentsByRestaurant(restaurantId, {
        page,
        limit: 15,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
        sortOrder,
      });
      setPayments(res.payments);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, page, statusFilter, search, sortOrder]);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 8000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const handleOpenOrder = (orderId: string) => {
    // Navigate to Order History with the order UUID as a query param.
    // The Order History page reads ?orderId= on mount and auto-opens the drawer.
    router.push(`/dashboard/orders/history?orderId=${encodeURIComponent(orderId)}`);
  };

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <span>Payments & Gateway Settlements</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Audit customer payments and automated gateway settlements in real-time.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchPayments}
          disabled={loading}
          className="gap-2 font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Records</span>
        </Button>
      </div>

      {/* Filters & Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full sm:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by phone, order ID, payment ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 shrink-0">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === opt.value
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date Sorting Filter */}
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as "desc" | "asc");
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Paginated Table Card */}
      <Card className="p-0 overflow-hidden">
        {error && (
          <div className="flex items-center gap-3 p-4 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            <p className="text-xs font-medium">Loading payment records...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
            <CreditCard className="h-10 w-10 text-slate-400 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Payments Found</p>
            <p className="text-xs text-slate-500">
              {statusFilter !== "all" || search ? "Try adjusting search or status filters" : "Payments will appear here automatically as customer checkouts occur."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 uppercase font-bold tracking-wider">
                  <th className="px-5 py-3.5 text-left">Payment ID</th>
                  <th className="px-5 py-3.5 text-left">Order ID</th>
                  <th className="px-5 py-3.5 text-left">Customer</th>
                  <th className="px-5 py-3.5 text-left">Method</th>
                  <th className="px-5 py-3.5 text-left">Gateway</th>
                  <th className="px-5 py-3.5 text-left">Amount</th>
                  <th className="px-5 py-3.5 text-left">Status</th>
                  <th className="px-5 py-3.5 text-left">Date & Time</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.map((payment) => {
                  return (
                    <tr
                      key={payment.id}
                      className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                        {payment.id.slice(0, 14)}…
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-300">
                        {payment.orderId.slice(0, 12)}…
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-700 dark:text-slate-300">
                        {payment.customerPhone || "Guest"}
                      </td>
                      <td className="px-5 py-4 capitalize font-medium text-slate-600 dark:text-slate-400">
                        {payment.paymentMethod ? payment.paymentMethod.replace(/_/g, " ") : "UPI"}
                      </td>
                      <td className="px-5 py-4 capitalize text-slate-600 dark:text-slate-400 font-medium">
                        {payment.providerName || "Razorpay"}
                      </td>
                      <td className="px-5 py-4 font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={payment.paymentStatus} />
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">
                        {payment.createdAt
                          ? new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
                            " " +
                            new Date(payment.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                          : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedPayment(payment)}
                          className="gap-1 font-bold text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Details</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">
            Page {page} of {totalPages} ({totalCount} total payments)
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment Details Drawer */}
      {selectedPayment && (
        <PaymentDetailsDrawer
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onOpenOrder={handleOpenOrder}
        />
      )}
    </div>
  );
}
