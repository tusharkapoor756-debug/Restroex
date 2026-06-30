const flow = ["Customer orders", "WhatsApp", "Kitchen", "Preparation", "Delivery", "Revenue"];

export default function HowItWorks() {
  return (
    <section id="workflow" className="border-t border-[#23242B]/80 bg-[#09090B] px-6 py-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-[#A78BFA]">Workflow</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            One clean path from demand to profit.
          </h2>
        </div>
        <div className="mt-9 grid gap-3 md:grid-cols-6">
          {flow.map((step, index) => (
            <div key={step} className="relative rounded-lg border border-[#23242B]/75 bg-[#111217] p-4 text-center">
              <div className="font-mono text-xs text-zinc-500">{String(index + 1).padStart(2, "0")}</div>
              <div className="mt-4 min-h-10 text-sm font-medium text-white">{step}</div>
              {index < flow.length - 1 && (
                <div className="absolute -right-3 top-1/2 z-10 hidden h-px w-3 bg-[#23242B] md:block" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
