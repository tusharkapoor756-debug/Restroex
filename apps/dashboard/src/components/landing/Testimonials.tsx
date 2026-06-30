// src/components/landing/Testimonials.tsx
"use client";

import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "Deploying Lia on our WhatsApp ordering reduced phone order bottlenecks completely. Our staff is happier, and ordering errors fell to zero.",
    author: "Elena Rostova",
    role: "Proprietor, Osteria Grandi",
    avatar: "👩‍🍳"
  },
  {
    quote: "Kai's order queue management optimization saved our kitchen crew from chaos during the Friday rush. Truly a production-grade AI.",
    author: "Marcus Vance",
    role: "Executive Chef, The Iron Grate",
    avatar: "👨‍🍳"
  },
  {
    quote: "With Sam handling inventory, we minimized wasted fresh food by 22% over three months. The automated reorder triggers are seamless.",
    author: "Sophia Chen",
    role: "General Manager, Greenery Bistro",
    avatar: "👩‍💼"
  }
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-violet-500">Reviews</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            What restaurant operators say
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t, idx) => (
            <div key={idx} className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-700/80 transition-all duration-300">
              <Quote className="h-8 w-8 text-violet-500/20 mb-6" />
              <p className="text-slate-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="text-2xl">{t.avatar}</div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{t.author}</h4>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
