const modules = [
  {
    title: "WhatsApp ordering",
    copy: "Messages become structured, priced and confirmed orders without creating another inbox for staff.",
    rows: ["Customer: 2 biryani, less spicy", "Matched: Hyderabadi biryani x2", "Payment link sent"],
  },
  {
    title: "Inventory control",
    copy: "Live depletion follows orders and prepares supplier drafts before a stockout becomes a service issue.",
    rows: ["Paneer: 18% remaining", "Mint: below par level", "Draft PO: Rs 8,420"],
  },
  {
    title: "CRM and recovery",
    copy: "Guest history, preferences and service exceptions are visible at the exact moment teams can act.",
    rows: ["VIP guest seated T7", "Prefers no onion", "Recovery: dessert comp approved"],
  },
  {
    title: "Staff coordination",
    copy: "Managers see station pressure and reassign people with context instead of chasing updates.",
    rows: ["Grill overloaded", "Prep has spare capacity", "Move Asha for 20m"],
  },
];

export default function ProductShowcase() {
  return (
    <section className="border-y border-[#23242B]/80 bg-[#0D0D10] px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-violet-300">How it becomes control</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
              Every module is connected to service, margin and guest experience.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-400">
              Restroex is not a collection of features. It is a shared operational model where each decision updates the next station automatically.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <div key={module.title} className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5">
                <h3 className="text-lg font-semibold text-white">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{module.copy}</p>
                <div className="mt-5 space-y-2">
                  {module.rows.map((row, index) => (
                    <div key={row} className="flex items-center gap-3 rounded-md bg-[#09090B] px-3 py-2 text-sm text-zinc-300">
                      <span className={`h-1.5 w-1.5 rounded-full ${index === 2 ? "bg-[#A78BFA]" : "bg-zinc-700"}`} />
                      {row}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
