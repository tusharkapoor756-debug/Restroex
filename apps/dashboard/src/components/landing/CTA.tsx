import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className="border-y border-[#23242B]/80 bg-[#0D0D10] px-6 py-16 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-violet-300">Ready for service</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
            Give your restaurant the operating system it should have had from day one.
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            See Restroex with your real menu, order channels and kitchen workflow mapped into the product.
          </p>
        </div>
        <a href="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-[#6B46C1] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7C5BD6]">
          Book operating review
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
