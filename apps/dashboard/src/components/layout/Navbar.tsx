import { useState } from "react";
import Container from "./Container";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 glass-navbar">
      <Container className="flex h-16 items-center justify-between">
        <Logo />

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-8 lg:flex">
          <a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            How it Works
          </a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            Pricing
          </a>
          <a href="#faq" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            FAQ
          </a>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="hidden md:flex">
            Login
          </Button>
          <Button>Start Free Trial</Button>
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            className="flex md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </Container>

      {/* Mobile menu panel */}
      <div
        id="mobile-menu"
        className={`md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300 ease-in-out overflow-hidden ${mobileMenuOpen ? "max-h-96" : "max-h-0"}`}
      >
        <nav className="flex flex-col gap-4 p-4 text-center">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
            How it Works
          </a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
            Pricing
          </a>
          <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
            FAQ
          </a>
          <Button variant="secondary" className="w-full" onClick={() => setMobileMenuOpen(false)}>
            Login
          </Button>
          <Button className="w-full" onClick={() => setMobileMenuOpen(false)}>
            Start Free Trial
          </Button>
        </nav>
      </div>
    </header>
  );
}