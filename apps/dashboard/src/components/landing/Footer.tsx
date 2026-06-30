import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-950 px-6 py-10 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-sm font-bold text-white">R</span>
            <span className="text-base font-semibold text-white">Restroex</span>
          </Link>
          <p className="mt-3 text-sm text-slate-500">Restaurant operations, controlled from one place.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-slate-500">
          <Link href="#problem" className="hover:text-slate-300">Problem</Link>
          <Link href="#preview" className="hover:text-slate-300">Product</Link>
          <Link href="#workflow" className="hover:text-slate-300">Workflow</Link>
          <Link href="#pricing" className="hover:text-slate-300">Pricing</Link>
        </div>
        <p className="text-sm text-slate-600">© {new Date().getFullYear()} Restroex. All rights reserved.</p>
      </div>
    </footer>
  );
}
