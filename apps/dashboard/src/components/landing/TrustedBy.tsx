// src/components/landing/TrustedBy.tsx
"use client";

export default function TrustedBy() {
  const logos = ["AeroMenu", "SizzleGroup", "BiteFlow", "UrbanPlate", "GustoCo"];
  
  return (
    <section className="py-12 border-y border-slate-800 bg-slate-950/30">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
          Trusted by the next generation of culinary innovators
        </p>
        <div className="mx-auto mt-8 grid max-cols-2 grid-cols-3 items-center justify-center gap-x-8 gap-y-10 sm:grid-cols-5 lg:mx-0">
          {logos.map((logo) => (
            <div 
              key={logo} 
              className="flex justify-center text-lg font-bold tracking-tight text-slate-400/70 hover:text-slate-200 transition-colors duration-200"
            >
              {logo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
