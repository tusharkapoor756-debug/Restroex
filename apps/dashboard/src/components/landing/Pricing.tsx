import { Check } from "lucide-react";

const plans = [
  {
    name: "Single outlet",
    price: "Rs 12,999",
    description: "For owner-led restaurants that need one source of operational truth.",
    features: ["Live order command", "WhatsApp ordering", "Kitchen queue", "Inventory alerts", "Customer profiles"],
  },
  {
    name: "Growth",
    price: "Rs 29,999",
    description: "For high-volume restaurants and expanding teams that need deeper coordination.",
    features: ["Everything in Single outlet", "Multi-station kitchen routing", "Supplier management", "Staff coordination", "Advanced analytics"],
    featured: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="border-t border-[#23242B]/80 bg-[#0D0D10] px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-violet-300">Pricing</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Simple plans for serious operators.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            Start with the operational core. Add deeper coordination when your restaurant volume demands it.
          </p>
        </div>

        <div className="mx-auto mt-9 grid max-w-5xl gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-lg border p-5 ${plan.featured ? "border-[#6B46C1]/40 bg-[#09090B] shadow-[0_18px_60px_rgba(0,0,0,0.22)]" : "border-[#23242B]/75 bg-[#09090B]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{plan.description}</p>
                </div>
                {plan.featured && <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-200">Most chosen</span>}
              </div>
              <div className="mt-6 flex items-end gap-2">
                <span className="text-4xl font-semibold text-white">{plan.price}</span>
                <span className="pb-1 text-sm text-slate-500">/ month</span>
              </div>
              <ul className="mt-6 space-y-3 border-t border-[#23242B]/75 pt-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-sm text-zinc-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/signup" className={`mt-6 inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition ${plan.featured ? "bg-[#6B46C1] text-white hover:bg-[#7C5BD6]" : "border border-[#23242B] text-zinc-200 hover:bg-[#111217]"}`}>
                Start with {plan.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
