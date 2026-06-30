"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { label: "Problem", href: "#problem" },
  { label: "Product", href: "#preview" },
  { label: "Workflow", href: "#workflow" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-4">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-xl border border-[#23242B] bg-[#09090B]/90 px-4 backdrop-blur-md" aria-label="Main navigation">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#6B46C1] text-sm font-bold text-white">R</span>
          <span className="text-base font-semibold tracking-normal text-white">Restroex</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-slate-400 transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-slate-400 transition hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#09090B] transition hover:bg-zinc-200">
            Start trial
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 text-slate-300 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-800 bg-slate-950 px-6 py-5 md:hidden">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="text-sm text-slate-300">
                {item.label}
              </Link>
            ))}
            <Link href="/signup" className="mt-2 rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-slate-950">
              Start trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
