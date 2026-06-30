// src/app/signup/page.tsx
"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthLayout from "../../components/auth/AuthLayout";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { AuthService } from "../../lib/services/auth.service";
import { isAuthenticated } from "../../lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    // Simple validation
    if (!fullName || !restaurantName || !phoneNumber || !email || !password) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setIsLoading(false);
      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service & Privacy Policy.");
      setIsLoading(false);
      return;
    }

    try {
      await AuthService.register({
        restaurantName,
        phoneNumber,
        email,
        password,
      });

      setSuccess(true);

      // New account always starts onboarding
      router.push("/onboarding");
    } catch (err: any) {
      setError(err?.message ?? "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start your 14-day free trial"
      linkText="Already have an account? Sign in"
      linkHref="/login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
            <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-sm">
            Account created! Setting up workspace...
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Chef Alex"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading || success}
              className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="restaurantName" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Restaurant Name
            </label>
            <input
              id="restaurantName"
              type="text"
              placeholder="Le Bistro"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              disabled={isLoading || success}
              className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phoneNumber" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            WhatsApp Phone Number
          </label>
          <input
            id="phoneNumber"
            type="tel"
            placeholder="+91 98765 43210"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isLoading || success}
            className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all disabled:opacity-50"
            required
          />
        </div>

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
          <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Password (min 8 chars)
          </label>
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

        <div className="flex items-start">
          <input
            id="agree-terms"
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            disabled={isLoading || success}
            className="h-4 w-4 rounded border-[#23242B] bg-slate-950 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900 focus:ring-offset-2 accent-violet-600 mt-0.5"
            required
          />
          <label htmlFor="agree-terms" className="ml-2 text-xs text-slate-400 leading-tight select-none">
            I agree to the{" "}
            <Link href="#" className="text-violet-400 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-violet-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || success}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white py-3 text-sm font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(124,58,237,0.15)] disabled:opacity-50 active:scale-[0.98] mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating workspace...
            </>
          ) : (
            "Start Free Trial"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
