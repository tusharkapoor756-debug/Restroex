"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  linkText?: string;
  linkHref?: string;
  imageAlt?: string;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  linkText,
  linkHref,
}: AuthLayoutProps) {
  const benefits = [
    "Operate WhatsApp ordering & automated kitchen tickets instantly.",
    "Manage categories, inventory, and supplier alerts in real-time.",
    "Gain complete control over operations with AI-powered sales insights."
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Left Column: Brand & Features (Hidden on small screens) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative border-r border-[#23242B]/40 bg-slate-950 overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -left-1/4 -top-1/4 h-[80%] w-[80%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-1/4 right-0 h-[60%] w-[60%] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white shadow-[0_0_20px_rgba(124,58,237,0.3)]">
              R
            </span>
            <span className="text-lg font-bold tracking-tight text-white font-sora">
              Restroex
            </span>
          </Link>
        </div>

        {/* Content */}
        <div className="relative z-10 my-auto max-w-lg space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white font-sora leading-tight">
              The modern operating system for <span className="text-violet-400">restaurants.</span>
            </h1>
            <p className="mt-4 text-slate-400 text-base leading-relaxed">
              Ditch manual coordination. Restroex brings orders, WhatsApp, menu, inventory, and analytics under a unified operational hub.
            </p>
          </div>

          <ul className="space-y-4">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-300 leading-normal">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Restroex Inc. All rights reserved.
        </div>
      </div>

      {/* Right Column: Form Container */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16 relative">
        {/* Mobile Logo Header */}
        <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
              R
            </span>
            <span className="text-md font-bold text-white font-sora">
              Restroex
            </span>
          </Link>
        </div>

        <div className="w-full max-w-md space-y-8">
          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold font-sora tracking-tight text-white">
              {title}
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                {subtitle}
              </p>
              {linkText && linkHref && (
                <Link
                  href={linkHref}
                  className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {linkText}
                </Link>
              )}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-slate-900/40 border border-[#23242B] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            {/* Subtle glow border */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
