"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
  ["Do we need to replace our POS?", "No. Restroex is designed to sit above your current tools and connect demand, kitchen and inventory workflows without forcing a hardware migration."],
  ["Can staff keep using WhatsApp?", "Yes. Restroex turns WhatsApp conversations into structured operational work while still keeping the channel familiar for customers."],
  ["How long does setup take?", "Most single-outlet teams can map their menu, stations, roles and inventory thresholds in the first onboarding session."],
  ["Where does automation stop?", "Restroex handles routine routing and updates, then surfaces exceptions for manager approval when a decision affects service, cost or guest recovery."],
];

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-[#09090B] px-6 py-14 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-sm font-semibold text-violet-300">FAQ</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">Questions operators ask first.</h2>
        </div>

        <div className="mt-8 divide-y divide-[#23242B]/75 rounded-lg border border-[#23242B]/75">
          {faqs.map(([question, answer], index) => {
            const isOpen = open === index;
            return (
              <div key={question} className="bg-[#09090B]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-white"
                >
                  {question}
                  {isOpen ? <Minus className="h-5 w-5 shrink-0 text-violet-300" /> : <Plus className="h-5 w-5 shrink-0 text-violet-300" />}
                </button>
                {isOpen && <p className="px-5 pb-4 text-sm leading-6 text-zinc-400">{answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
