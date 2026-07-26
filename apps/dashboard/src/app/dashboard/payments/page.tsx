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
import { PaymentsService } from "../../../lib/services/payments.service";
import { Payment, PaymentStatus } from "../../../types";
import { getRestaurantSession } from "../../../lib/auth";

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

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Verification Modal ────────────────────────────────────────────────────────

interface ModalProps {
  payment: Payment;
  onClose: () => void;
  onVerified: () => void;
  onRejected: () => void;
}

function VerificationModal({ payment, onClose, onVerified, onRejected }: ModalProps) {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const [action, setAction] = useState<"idle" | "verifying" | "rejecting">("idle");
  const [verifiedAmount, setVerifiedAmount] = useState(String(payment.amount));
  const [verifiedTxRef, setVerifiedTxRef] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load screenshot as signed URL on mount
  useEffect(() => {
    const hasScreenshot =
      payment.paymentStatus === "screenshot_uploaded" ||
      payment.paymentStatus === "pending_verification" ||
      payment.paymentStatus === "verified" ||
      payment.paymentStatus === "rejected";

    if (!hasScreenshot) return;

    setScreenshotLoading(true);
    PaymentsService.getScreenshotUrl(payment.id)
      .then((res) => setScreenshotUrl(res.signedUrl))
      .catch((err) => setScreenshotError(err.message || "Could not load screenshot"))
      .finally(() => setScreenshotLoading(false));
  }, [payment.id, payment.paymentStatus]);

  const handleVerify = async () => {
    setError(null);
    setAction("verifying");
    try {
      await PaymentsService.verifyPayment(payment.id, {
        notes: verifyNotes || undefined,
        verifiedAmount: verifiedAmount ? Number(verifiedAmount) : undefined,
        verifiedTransactionReference: verifiedTxRef || undefined,
      });
      onVerified();
    } catch (err: any) {
      setError(err.message || "Verification failed");
      setAction("idle");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError("Please enter a rejection reason");
      return;
    }
    setError(null);
    setAction("rejecting");
    try {
      await PaymentsService.rejectPayment(payment.id, { reason: rejectReason });
      onRejected();
    } catch (err: any) {
      setError(err.message || "Rejection failed");
      setAction("idle");
    }
  };

  const canVerify =
    payment.paymentStatus === "pending_verification" ||
    payment.paymentStatus === "screenshot_uploaded";
  const canReject = canVerify;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-[#23242B] bg-[#111113] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#23242B]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30">
              <CreditCard className="w-4.5 h-4.5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Payment Review</h2>
              <p className="text-xs text-slate-500 font-mono">{payment.id.slice(0, 16)}…</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-[#23242B] max-h-[75vh] overflow-y-auto">
          {/* Left — Screenshot */}
          <div className="p-5 flex flex-col gap-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Payment Screenshot</p>
            <div className="rounded-xl border border-[#23242B] bg-[#0D0D0F] flex items-center justify-center min-h-48 overflow-hidden">
              {screenshotLoading && (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-xs">Loading screenshot…</p>
                </div>
              )}
              {screenshotError && (
                <div className="flex flex-col items-center gap-2 text-slate-500 p-4 text-center">
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">{screenshotError}</p>
                </div>
              )}
              {screenshotUrl && !screenshotLoading && (
                <a href={screenshotUrl} target="_blank" rel="noreferrer" className="block w-full">
                  <img
                    src={screenshotUrl}
                    alt="Payment screenshot"
                    className="w-full object-contain max-h-72 hover:scale-105 transition-transform duration-200"
                  />
                </a>
              )}
              {!screenshotLoading && !screenshotError && !screenshotUrl && (
                <div className="flex flex-col items-center gap-2 text-slate-500 p-4 text-center">
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                  <p className="text-xs">No screenshot uploaded yet</p>
                </div>
              )}
            </div>

            {/* Customer Info */}
            <div className="rounded-xl border border-[#23242B] bg-[#0D0D0F] p-4 space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Customer</p>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-mono">{payment.customerPhone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-emerald-400">{formatAmount(payment.amount)}</span>
                <span className="text-slate-500 text-xs">via {payment.paymentMethod.replace("_", " ")}</span>
              </div>
              <StatusBadge status={payment.paymentStatus} />
            </div>

            {/* Payment Intelligence Engine OCR Result Card */}
            {payment.gatewayData?.analysis_result ? (
              <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                    <Shield className="w-4 h-4 text-violet-400" />
                    <span>Payment Intelligence Report</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      payment.gatewayData.analysis_result.recommendedAction === 'APPROVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : payment.gatewayData.analysis_result.recommendedAction === 'REJECT'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {payment.gatewayData.analysis_result.recommendedAction.replace('_', ' ')}
                  </span>
                </div>

                {/* 3 Score Header Summary */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-[#0D0D0F] p-2 border border-[#23242B] text-center">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">OCR Confidence</span>
                    <span className="font-bold text-violet-400 text-sm">
                      {payment.gatewayData.analysis_result.ocrConfidence ?? payment.gatewayData.analysis_result.extractedDetails?.overallConfidence ?? 0}%
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#0D0D0F] p-2 border border-[#23242B] text-center">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Verification Score</span>
                    <span className={`font-bold text-sm ${
                      (payment.gatewayData.analysis_result.verificationScore ?? 0) >= 80 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {payment.gatewayData.analysis_result.verificationScore ?? payment.gatewayData.analysis_result.overallConfidence}%
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#0D0D0F] p-2 border border-[#23242B] text-center">
                    <span className="text-slate-500 block text-[9px] uppercase font-semibold">Fraud Risk</span>
                    <span className={`font-bold text-sm ${
                      payment.gatewayData.analysis_result.riskScore >= 50 ? 'text-red-400' : 'text-slate-200'
                    }`}>
                      {payment.gatewayData.analysis_result.riskScore}/100
                    </span>
                  </div>
                </div>

                {/* SECTION 1: OCR EXTRACTION (NO PASS/FAIL HERE) */}
                {payment.gatewayData.analysis_result.extractedDetails && (
                  <div className="space-y-1.5 bg-[#0D0D0F] p-3 rounded-lg border border-[#23242B]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">
                        1. OCR Extraction (Raw Evidence)
                      </p>
                      <span className="text-[9px] text-slate-400">Source: {payment.gatewayData.analysis_result.analysisSource ?? 'Local OCR'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs pt-1">
                      <div className="flex justify-between py-0.5 border-b border-[#1A1B23]">
                        <span className="text-slate-400">Amount:</span>
                        <span className="font-semibold text-slate-200">
                          {payment.gatewayData.analysis_result.extractedDetails.amount?.value ? `Extracted (₹${payment.gatewayData.analysis_result.extractedDetails.amount.value})` : 'Not Detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-[#1A1B23]">
                        <span className="text-slate-400">Receiver Name:</span>
                        <span className="font-semibold text-slate-200">
                          {payment.gatewayData.analysis_result.extractedDetails.receiverName?.value ? `Extracted (${payment.gatewayData.analysis_result.extractedDetails.receiverName.value})` : 'Not Detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-[#1A1B23]">
                        <span className="text-slate-400">Receiver UPI:</span>
                        <span className="font-mono text-slate-200">
                          {payment.gatewayData.analysis_result.extractedDetails.receiverUpiId?.value ? `Extracted (${payment.gatewayData.analysis_result.extractedDetails.receiverUpiId.value})` : 'Not Detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-[#1A1B23]">
                        <span className="text-slate-400">UTR / Ref:</span>
                        <span className="font-mono text-slate-200">
                          {payment.gatewayData.analysis_result.extractedDetails.upiReference?.value ? `Extracted (${payment.gatewayData.analysis_result.extractedDetails.upiReference.value})` : 'Not Detected'}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 col-span-2">
                        <span className="text-slate-400">Payment Status:</span>
                        <span className="font-semibold text-slate-200">
                          Screenshot Shows {payment.gatewayData.analysis_result.extractedDetails.paymentStatusInScreenshot?.value ?? 'UNKNOWN'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 2: PAYMENT VERIFICATION (THE ONLY PLACE PASS/FAIL EXISTS) */}
                {payment.gatewayData.analysis_result.merchantVerification && (
                  <div className="space-y-1.5 bg-[#0D0D0F] p-3 rounded-lg border border-[#23242B]">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      2. Payment Verification (Business Rules)
                    </p>
                    {payment.gatewayData.analysis_result.merchantVerification.rules.map((rule: any) => {
                      const isUnconfigured = rule.expected === 'Not Configured';
                      return (
                        <div key={rule.ruleId} className="flex items-start justify-between py-1 border-b border-[#1A1B23] last:border-0 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-slate-300 font-semibold">{rule.title}</span>
                            <span className="text-[10px] text-slate-500 block">
                              Restaurant: <span className="font-mono text-slate-400">{rule.expected}</span> ↓ Screenshot: <span className="font-mono text-slate-300">{rule.actual}</span>
                            </span>
                          </div>
                          <span
                            className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                              isUnconfigured
                                ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                : rule.passed
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {isUnconfigured ? 'NOT CONFIGURED' : rule.passed ? '✔ PASS' : '❌ FAIL'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SECTION 3: FRAUD SIGNALS & RISK ANALYSIS */}
                <div className="space-y-1.5 bg-[#0D0D0F] p-3 rounded-lg border border-[#23242B]">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    3. Fraud Signals & Risk Analysis
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex justify-between py-1 px-2 rounded bg-[#14151C] border border-[#23242B]">
                      <span className="text-slate-400">Duplicate Screenshot:</span>
                      <span className={`font-bold text-[10px] ${payment.gatewayData.analysis_result.duplicate ? 'text-red-400' : 'text-emerald-400'}`}>
                        {payment.gatewayData.analysis_result.duplicate ? 'Detected ⚠️' : 'Not Detected'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 px-2 rounded bg-[#14151C] border border-[#23242B]">
                      <span className="text-slate-400">Risk Score Level:</span>
                      <span className={`font-bold text-[10px] ${payment.gatewayData.analysis_result.riskScore >= 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {payment.gatewayData.analysis_result.riskScore >= 50 ? 'High Risk' : 'Low Risk'} ({payment.gatewayData.analysis_result.riskScore}/100)
                      </span>
                    </div>
                  </div>
                </div>

                {/* DECISION BANNER & 3-SECOND HUMAN EXPLANATION */}
                {payment.gatewayData.analysis_result.humanSummary && (
                  <div
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      payment.gatewayData.analysis_result.recommendedAction === 'APPROVE'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : payment.gatewayData.analysis_result.recommendedAction === 'REJECT'
                        ? 'bg-red-950/20 border-red-500/30 text-red-300'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">
                      Decision: {payment.gatewayData.analysis_result.recommendedAction}
                    </p>
                    <p className="text-[11px]">
                      {payment.gatewayData.analysis_result.humanSummary}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Right — Actions */}
          <div className="p-5 flex flex-col gap-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Verification</p>

            {!showRejectForm ? (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Verified Amount (₹)</label>
                    <input
                      type="number"
                      value={verifiedAmount}
                      onChange={(e) => setVerifiedAmount(e.target.value)}
                      className="w-full rounded-lg border border-[#23242B] bg-[#0D0D0F] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="e.g. 450.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Transaction Reference (optional)</label>
                    <input
                      value={verifiedTxRef}
                      onChange={(e) => setVerifiedTxRef(e.target.value)}
                      className="w-full rounded-lg border border-[#23242B] bg-[#0D0D0F] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
                      placeholder="UTR / Transaction ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
                    <textarea
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#23242B] bg-[#0D0D0F] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                      placeholder="Any notes…"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-2 mt-auto">
                  {canVerify && (
                    <button
                      onClick={handleVerify}
                      disabled={action !== "idle"}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                    >
                      {action === "verifying" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BadgeCheck className="w-4 h-4" />
                      )}
                      {action === "verifying" ? "Verifying…" : "Approve Payment"}
                    </button>
                  )}
                  {canReject && (
                    <button
                      onClick={() => setShowRejectForm(true)}
                      disabled={action !== "idle"}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 text-red-400 text-sm font-medium py-2.5 transition-all duration-200"
                    >
                      <Ban className="w-4 h-4" />
                      Reject Payment
                    </button>
                  )}
                  {!canVerify && !canReject && (
                    <p className="text-xs text-center text-slate-500 py-2">
                      This payment has already been {payment.paymentStatus}.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <p className="text-sm text-slate-300">Provide a reason for rejection. This will be sent to the customer via WhatsApp.</p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    autoFocus
                    className="w-full rounded-lg border border-red-500/30 bg-[#0D0D0F] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                    placeholder="e.g. Screenshot is unclear, amount mismatch, wrong UPI ID…"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => { setShowRejectForm(false); setError(null); }}
                    className="flex-1 rounded-xl border border-[#23242B] hover:bg-white/5 text-slate-400 text-sm py-2.5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={action !== "idle" || !rejectReason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-all"
                  >
                    {action === "rejecting" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Ban className="w-4 h-4" />
                    )}
                    {action === "rejecting" ? "Rejecting…" : "Confirm Reject"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting Verification", value: "pending_verification" },
  { label: "Screenshot Uploaded", value: "screenshot_uploaded" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    const session = getRestaurantSession();
    if (session?.id) setRestaurantId(session.id);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await PaymentsService.getPaymentsByRestaurant(restaurantId);
      setPayments(data);
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 5000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const filtered = payments.filter((p) => {
    const matchStatus = statusFilter === "all" || p.paymentStatus === statusFilter;
    const matchSearch =
      !search ||
      p.customerPhone.includes(search) ||
      p.orderId.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Stats
  const totalVerified = payments.filter((p) => p.paymentStatus === "verified").length;
  const totalPendingVerification = payments.filter(
    (p) => p.paymentStatus === "pending_verification" || p.paymentStatus === "screenshot_uploaded"
  ).length;
  const totalRevenue = payments
    .filter((p) => p.paymentStatus === "verified")
    .reduce((sum, p) => sum + p.amount, 0);

  const handleModalClose = () => {
    setSelectedPayment(null);
    fetchPayments();
  };

  return (
    <div className="min-h-full bg-[#09090B] text-slate-100 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Payments</h1>
            <p className="text-sm text-slate-500 mt-0.5">Verify and manage Manual UPI payments from customers.</p>
          </div>
          <button
            onClick={fetchPayments}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#23242B] hover:bg-white/5 text-slate-400 hover:text-slate-200 text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#23242B] bg-[#111113] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 border border-violet-500/30">
                <Shield className="w-4.5 h-4.5 text-violet-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Awaiting Verification</p>
            </div>
            <p className="text-3xl font-bold text-slate-100">{totalPendingVerification}</p>
            <p className="text-xs text-slate-500 mt-1">Need your attention</p>
          </div>

          <div className="rounded-2xl border border-[#23242B] bg-[#111113] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/20 border border-emerald-500/30">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Verified Today</p>
            </div>
            <p className="text-3xl font-bold text-slate-100">{totalVerified}</p>
            <p className="text-xs text-slate-500 mt-1">Confirmed payments</p>
          </div>

          <div className="rounded-2xl border border-[#23242B] bg-[#111113] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600/20 border border-amber-500/30">
                <IndianRupee className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Revenue</p>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{formatAmount(totalRevenue)}</p>
            <p className="text-xs text-slate-500 mt-1">From verified payments</p>
          </div>
        </div>

        {/* ── Filters & Search ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone, order ID, payment ID…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#23242B] bg-[#111113] text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === opt.value
                    ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.4)]"
                    : "border border-[#23242B] bg-[#111113] text-slate-400 hover:text-slate-200 hover:border-slate-600"
                }`}
              >
                {opt.label}
                {opt.value !== "all" && (
                  <span className="ml-1.5 opacity-60">
                    {payments.filter((p) => p.paymentStatus === opt.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-2xl border border-[#23242B] bg-[#111113] overflow-hidden">
          {error && (
            <div className="flex items-center gap-3 p-4 border-b border-[#23242B] bg-red-500/5 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {loading && !payments.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              <p className="text-sm">Loading payments…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <CreditCard className="w-10 h-10 text-slate-700" />
              <p className="text-sm">No payments found</p>
              <p className="text-xs text-slate-600">
                {statusFilter !== "all" ? "Try changing the filter" : "Payments will appear here after checkout"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#23242B]">
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Payment</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Method</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#23242B]/60">
                  {filtered.map((payment) => {
                    const needsAction =
                      payment.paymentStatus === "pending_verification" ||
                      payment.paymentStatus === "screenshot_uploaded";
                    return (
                      <tr
                        key={payment.id}
                        className={`group transition-colors ${needsAction ? "bg-violet-600/5 hover:bg-violet-600/10" : "hover:bg-white/[0.02]"}`}
                      >
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-mono text-xs text-slate-300">{payment.id.slice(0, 14)}…</p>
                            <p className="text-xs text-slate-600 mt-0.5">Order: {payment.orderId.slice(0, 10)}…</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-600" />
                            <span className="font-mono text-sm">{payment.customerPhone}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-slate-400 capitalize">
                            {payment.paymentMethod.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-200">{formatAmount(payment.amount)}</span>
                          {payment.verifiedAmount && payment.verifiedAmount !== payment.amount && (
                            <p className="text-xs text-emerald-400 mt-0.5">Verified: {formatAmount(payment.verifiedAmount)}</p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={payment.paymentStatus} />
                          {needsAction && (
                            <span className="block mt-1 text-xs text-violet-400 animate-pulse">● Action needed</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs text-slate-500">{timeAgo(payment.createdAt)}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              needsAction
                                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]"
                                : "border border-[#23242B] hover:bg-white/5 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {needsAction ? "Verify" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#23242B]/60 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Showing {filtered.length} of {payments.length} payments
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Verification Modal ── */}
      {selectedPayment && (
        <VerificationModal
          payment={selectedPayment}
          onClose={handleModalClose}
          onVerified={() => { handleModalClose(); }}
          onRejected={() => { handleModalClose(); }}
        />
      )}
    </div>
  );
}
