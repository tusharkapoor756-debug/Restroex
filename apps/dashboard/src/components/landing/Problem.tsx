import { AlertTriangle, TimerReset, WalletCards } from "lucide-react";

const issues = [
  {
    icon: AlertTriangle,
    title: "Orders arrive everywhere",
    copy: "WhatsApp, phone, dine-in, delivery apps and staff notes compete for attention during peak service.",
    signal: "7 unassigned inputs",
  },
  {
    icon: TimerReset,
    title: "The kitchen sees too late",
    copy: "Manual handoffs turn confirmed demand into delayed tickets, remakes and anxious front-of-house updates.",
    signal: "18 min ticket drift",
  },
  {
    icon: WalletCards,
    title: "Profit leaks quietly",
    copy: "Inventory, labor and guest history live in separate tools, so managers react after the margin is already gone.",
    signal: "11 stock exceptions",
  },
];

export default function Problem() {
  return (
    <section id="problem" className="border-b border-[#23242B]/80 bg-[#09090B] px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-violet-300">Why restaurants lose control</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
              The work is not broken. The operating layer is.
            </h2>
          </div>
          <p className="max-w-3xl text-base leading-7 text-zinc-400">
            Most restaurants already have talented teams and useful tools. The missing piece is a single system that keeps demand, kitchen capacity, inventory and customers in sync while service is happening.
          </p>
        </div>

        <div className="mt-9 grid gap-3 md:grid-cols-3">
          {issues.map((issue) => {
            const Icon = issue.icon;
            return (
              <div key={issue.title} className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#09090B] text-[#A78BFA]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-[#23242B] px-3 py-1 text-xs text-zinc-400">{issue.signal}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{issue.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{issue.copy}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
