// src/app/forgot-password/page.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import AuthLayout from "../../components/auth/AuthLayout";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { AuthService } from "../../lib/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email) {
      setError("Please enter your email address.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await AuthService.forgotPassword(email);
      setTempPassword(res.temporaryPassword ?? null);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email to receive a recovery link"
    >
      {success ? (
        <div className="space-y-6 py-2 text-center text-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-sora text-white">Temporary Password Generated</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              A temporary password has been successfully generated for <span className="text-slate-200 font-semibold">{email}</span>.
            </p>
            {tempPassword && (
              <div className="mt-4 p-3 bg-slate-950 border border-[#23242B] rounded-xl font-mono text-sm text-violet-400 select-all">
                {tempPassword}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Use this temporary password to log in, and make sure to change it in your settings afterward.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
              <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-sm font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(124,58,237,0.15)] disabled:opacity-50 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
