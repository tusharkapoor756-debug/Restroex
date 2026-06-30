const outcomes = [
  ["More orders", "Every channel becomes one managed flow."],
  ["Faster service", "Kitchen work is sequenced before pressure builds."],
  ["Fewer mistakes", "Staff see the same order, status and context."],
  ["Better profits", "Inventory and revenue move together."],
];

export default function Solution() {
  return (
    <section className="bg-[#09090B] px-6 py-14 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-[#A78BFA]">The operating layer</p>
          <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Restroex makes the whole restaurant move as one system.
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-[#23242B] bg-[#23242B] sm:grid-cols-2">
          {outcomes.map(([title, copy]) => (
            <div key={title} className="bg-[#111217] p-5">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
