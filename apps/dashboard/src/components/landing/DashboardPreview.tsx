import { ChefHat, PackageCheck, UsersRound } from "lucide-react";

const queue = [
  ["#1843", "T12", "Masala dosa x2", "Cooking", "7m"],
  ["#1844", "Delivery", "Butter chicken combo", "Queued", "18m"],
  ["#1845", "Pickup", "Thai basil noodles", "Ready", "0m"],
];

export default function DashboardPreview() {
  return (
    <section id="preview" className="bg-[#09090B] px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-violet-300">The product</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            One screen that tells the truth about tonight.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            Restroex turns every active channel into a live operational picture, so owners know what is happening, what is late and what needs a decision.
          </p>
        </div>

        <div className="mt-9 overflow-hidden rounded-xl border border-[#23242B]/80 bg-[#111217] shadow-[0_26px_80px_rgba(0,0,0,0.34)]">
          <div className="flex items-center justify-between border-b border-[#23242B]/80 px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-white">Restroex Command</p>
              <p className="text-xs text-zinc-500">Saturday dinner service - 7:42 PM</p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-zinc-400 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              All stations synced
            </div>
          </div>

          <div className="grid lg:grid-cols-[220px_1fr]">
            <aside className="hidden border-r border-[#23242B]/80 bg-[#09090B] p-3 lg:block">
              {["Live floor", "Orders", "Kitchen", "Inventory", "Customers", "Staff"].map((item, index) => (
                <div key={item} className={`rounded-md px-3 py-2 text-sm ${index === 0 ? "bg-[#6B46C1]/12 text-[#C4B5FD]" : "text-zinc-500"}`}>
                  {item}
                </div>
              ))}
            </aside>

            <div className="p-3.5 sm:p-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [ChefHat, "Kitchen pressure", "74%", "Grill is busiest"],
                  [PackageCheck, "Inventory risk", "3 items", "Auto draft ready"],
                  [UsersRound, "Guest recovery", "8 tables", "VIPs identified"],
                ].map(([Icon, title, value, label]) => {
                  const StatIcon = Icon as typeof ChefHat;
                  return (
                    <div key={String(title)} className="rounded-lg border border-[#23242B]/75 bg-[#09090B] p-4">
                      <div className="flex items-center justify-between text-zinc-500">
                        <StatIcon className="h-4 w-4 text-violet-300" />
                        <span className="text-xs">{String(label)}</span>
                      </div>
                      <p className="mt-4 text-sm text-zinc-400">{String(title)}</p>
                      <p className="mt-1 text-3xl font-semibold text-white">{String(value)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-lg border border-[#23242B]/75 bg-[#09090B]">
                  <div className="border-b border-[#23242B]/75 px-4 py-3 text-sm font-semibold text-white">Kitchen queue</div>
                  <div className="divide-y divide-[#23242B]/75">
                    {queue.map(([id, channel, item, status, eta]) => (
                      <div key={id} className="grid grid-cols-[72px_1fr_80px_48px] items-center gap-3 px-4 py-3.5 text-sm">
                        <span className="font-mono text-violet-300">{id}</span>
                        <div>
                          <p className="font-medium text-slate-100">{item}</p>
                          <p className="text-xs text-zinc-500">{channel}</p>
                        </div>
                        <span className="text-slate-300">{status}</span>
                        <span className="text-right text-slate-500">{eta}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#23242B]/75 bg-[#09090B] p-4">
                  <p className="text-sm font-semibold text-white">Manager brief</p>
                  <div className="mt-4 space-y-3">
                    {[
                      "Move one commis from prep to grill for 20 minutes.",
                      "Approve supplier draft for paneer and fresh mint.",
                      "Offer table 7 dessert recovery before billing.",
                    ].map((item) => (
                      <div key={item} className="rounded-md border border-[#23242B]/75 bg-[#111217] p-3 text-sm leading-6 text-zinc-300">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
