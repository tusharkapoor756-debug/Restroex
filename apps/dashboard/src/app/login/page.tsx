// src/app/login/page.tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "../../components/auth/AuthLayout";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { AuthService } from "../../lib/services/auth.service";
import { isAuthenticated } from "../../lib/auth";
import { RestaurantService } from "../../lib/services/restaurant.service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Authenticate with the backend
      await AuthService.login(email, password, rememberMe);

      // 2. Fetch setup state to determine if onboarding is complete
      const setupRes = await RestaurantService.getSetup();

      setSuccess(true);

      if (setupRes.isComplete) {
        // Restaurant already fully configured — skip onboarding
        router.push("/dashboard");
      } else {
        // Onboarding incomplete — send to onboarding to resume
        router.push("/onboarding");
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please check your credentials.");
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your restaurant"
      linkText="Sign up for free"
      linkHref="/signup"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-sm">
            Sign in successful! Redirecting...
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
            disabled={isLoading || success}
            className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || success}
              className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl pl-4 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || success}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading || success}
            className="h-4 w-4 rounded border-[#23242B] bg-slate-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 focus:ring-offset-2 accent-violet-600"
          />
          <label htmlFor="remember-me" className="ml-2 text-sm text-slate-400 select-none">
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || success}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-sm font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(124,58,237,0.15)] disabled:opacity-50 active:scale-[0.98]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
