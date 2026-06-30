import { ArrowRight, CheckCircle2, Clock3, MessageSquareText, Utensils } from "lucide-react";

const orders = [
  { id: "R-1842", source: "WhatsApp", table: "Pickup", items: "Paneer tikka bowl, lime soda", eta: "11m", status: "Accepted", total: "Rs 640" },
  { id: "R-1843", source: "Dine-in", table: "T12", items: "2 masala dosa, filter coffee", eta: "7m", status: "Cooking", total: "Rs 520" },
  { id: "R-1844", source: "Delivery", table: "Swiggy", items: "Butter chicken combo", eta: "18m", status: "Queued", total: "Rs 790" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[#23242B]/80 bg-[#09090B] px-6 pb-12 pt-24 sm:pb-14 lg:px-8 lg:pt-28">
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.55fr_0.45fr]">
        <div className="max-w-[640px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#23242B] bg-[#111217] px-3 py-1 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6B46C1]" />
            Restaurant Operating System
          </div>
          <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-[72px]">
            Run every restaurant operation from one calm command center.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-7 text-zinc-400">
            Restroex unifies live orders, WhatsApp ordering, kitchen queues, inventory, staff and customer operations into one premium control layer.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#preview" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#6B46C1] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7C5BD6]">
              View product
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href="#pricing" className="inline-flex items-center justify-center rounded-md border border-[#23242B] bg-[#111217] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600">
              See pricing
            </a>
          </div>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-[#23242B]/80 pt-5">
            {[
              ["98.7%", "orders captured"],
              ["14 min", "avg prep time"],
              ["31%", "less waste"],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="text-2xl font-semibold text-white">{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-[#23242B]/80 bg-[#111217] shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
          <div className="flex items-center justify-between border-b border-[#23242B]/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Evening service</p>
              <p className="text-xs text-zinc-500">Indiranagar flagship - live now</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Healthy
            </div>
          </div>
          <div className="grid gap-2.5 p-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  ["Revenue", "Rs 86k"],
                  ["Orders", "142"],
                  ["Open", "18"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#23242B]/70 bg-[#09090B] p-3">
                    <p className="text-[11px] text-zinc-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              {orders.map((order) => (
                <div key={order.id} className="rounded-lg border border-[#23242B]/70 bg-[#09090B] p-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <span className="font-mono text-[#A78BFA]">{order.id}</span>
                        <span>{order.source}</span>
                        <span>{order.table}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-zinc-100">{order.items}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full border border-[#23242B] px-2 py-1 text-[11px] text-zinc-300">{order.status}</span>
                      <p className="mt-2 text-xs text-zinc-500">{order.total}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Kitchen ETA {order.eta}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <div className="rounded-lg border border-[#23242B]/70 bg-[#09090B] p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Utensils className="h-4 w-4 text-violet-300" />
                  Kitchen load
                </div>
                <div className="mt-4 space-y-3">
                  {["Grill", "Tandoor", "Beverage"].map((station, index) => (
                    <div key={station}>
                      <div className="mb-2 flex justify-between text-xs text-zinc-400">
                        <span>{station}</span>
                        <span>{[82, 64, 38][index]}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-[#23242B]">
                        <div className="h-1 rounded-full bg-[#6B46C1]" style={{ width: `${[82, 64, 38][index]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-[#23242B]/70 bg-[#09090B] p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquareText className="h-4 w-4 text-violet-300" />
                  WhatsApp intake
                </div>
                <p className="mt-3 text-sm text-slate-300">12 conversations converted into confirmed orders this hour.</p>
              </div>
              <div className="rounded-lg border border-[#6B46C1]/25 bg-[#6B46C1]/10 p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                  <CheckCircle2 className="h-4 w-4" />
                  Manager attention
                </div>
                <p className="mt-2 text-sm text-slate-300">Only 2 exceptions require approval.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
