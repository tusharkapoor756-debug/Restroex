// src/components/landing/AIEmployees.tsx
"use client";

import { MessageSquare, Calendar, CookingPot, TrendingUp } from "lucide-react";
import { useState } from "react";

const EMPLOYEES = [
  {
    id: "lia",
    name: "Lia",
    role: "Front-of-House AI",
    avatar: "💬",
    icon: MessageSquare,
    skills: ["WhatsApp & Phone Ordering", "Instant Reservation Booking", "General Customer Support"],
    motto: "Handling hundreds of hungry callers simultaneously with zero wait time.",
    dialog: "Hi! Welcome back to Bistro. Would you like your usual Truffle Pasta or something new today?"
  },
  {
    id: "kai",
    name: "Kai",
    role: "Kitchen Operations AI",
    avatar: "🍳",
    icon: CookingPot,
    skills: ["Order Queue Prioritization", "Ingredient Scarcity Warnings", "POS and KDS Syncing"],
    motto: "Optimizing the ticket line so food always goes out fresh and hot.",
    dialog: "Alert: Prep table 2. Ribeye cooking times are running 3 mins behind average. Re-routing next tickets."
  },
  {
    id: "sam",
    name: "Sam",
    role: "Supply & Inventory AI",
    avatar: "📦",
    icon: Calendar,
    skills: ["Predictive Reordering", "Vendor Price Auditing", "Waste Minimization"],
    motto: "Buying smart so you never run out of ingredients or over-order.",
    dialog: "Based on weekend weather reports and previous trends, I've adjusted your avocado order by +15%."
  }
];

export default function AIEmployees() {
  const [active, setActive] = useState(EMPLOYEES[0].id);
  const current = EMPLOYEES.find((emp) => emp.id === active)!;

  return (
    <section id="ai" className="py-20 bg-slate-900/40 relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <h2 className="text-base font-semibold leading-7 text-violet-500">Your Virtual Team</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Meet your autonomous AI Employees
          </p>
          <p className="mt-4 text-base text-slate-450 leading-relaxed">
            Deploy specialized, highly trained AI modules that take charge of specific roles inside your restaurant.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Employee Tabs */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {EMPLOYEES.map((emp) => (
              <button
                key={emp.id}
                onClick={() => setActive(emp.id)}
                className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-200 ${
                  active === emp.id
                    ? "bg-slate-900 border-violet-500/50 shadow-lg shadow-violet-500/5"
                    : "bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/50"
                }`}
              >
                <div className="text-3xl">{emp.avatar}</div>
                <div>
                  <h3 className="font-semibold text-white">{emp.name}</h3>
                  <p className="text-xs text-slate-400">{emp.role}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Active Employee Showcase */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative">
              <div className="flex items-center gap-3 text-violet-400">
                <current.icon className="h-6 w-6" />
                <span className="text-sm font-semibold tracking-wider uppercase">{current.role}</span>
              </div>
              <h3 className="text-3xl font-bold text-white mt-4">{current.name}</h3>
              <p className="text-slate-300 italic mt-2">"{current.motto}"</p>

              <div className="mt-8">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Core Skills</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {current.skills.map((skill) => (
                    <li key={skill} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Conversation Preview / System output */}
            <div className="mt-8 p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs text-slate-500 font-mono">LIVE FEED - {current.name}</span>
              </div>
              <p className="text-sm font-mono text-violet-300">&gt; {current.dialog}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
