const floor = [
  ["T4", "Seated", "Rs 3,240"],
  ["T7", "Dessert recovery", "VIP"],
  ["T12", "Billing", "Rs 1,860"],
];

export default function Features() {
  return (
    <section id="features" className="border-t border-[#23242B]/80 bg-[#09090B] px-6 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-[#A78BFA]">Built for the floor</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Product depth without operational noise.
          </h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Dining room</p>
                <p className="mt-1 text-xs text-zinc-500">Guests, tickets and recovery in one view</p>
              </div>
              <span className="text-xs text-zinc-500">18 active tables</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {floor.map(([table, status, value]) => (
                <div key={table} className="rounded-md border border-[#23242B]/75 bg-[#09090B] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-[#A78BFA]">{table}</span>
                    <span className="text-zinc-500">{value}</span>
                  </div>
                  <p className="mt-6 text-sm font-medium text-white">{status}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5">
            <p className="text-sm font-semibold text-white">Supplier draft</p>
            <div className="mt-5 space-y-3 text-sm">
              {["Paneer 12 kg", "Mint 6 bunches", "Basmati 25 kg"].map((item) => (
                <div key={item} className="flex justify-between rounded-md bg-[#09090B] px-3 py-2 text-zinc-300">
                  <span>{item}</span>
                  <span className="text-zinc-500">Approve</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5">
            <p className="text-sm font-semibold text-white">Revenue pulse</p>
            <p className="mt-4 text-4xl font-semibold text-white">Rs 86,420</p>
            <p className="mt-2 text-sm text-zinc-500">Dinner service so far</p>
          </div>

          <div className="rounded-lg border border-[#23242B]/75 bg-[#111217] p-5 lg:col-span-2">
            <p className="text-sm font-semibold text-white">Manager summary</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {["Add one runner for pickup", "Delay biryani promise by 6m", "Call back table 7 after dessert"].map((item) => (
                <div key={item} className="rounded-md bg-[#09090B] p-4 text-sm leading-6 text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
