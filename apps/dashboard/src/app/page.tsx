import CTA from "../components/landing/CTA";
import DashboardPreview from "../components/landing/DashboardPreview";
import FAQ from "../components/landing/FAQ";
import Features from "../components/landing/Features";
import Footer from "../components/landing/Footer";
import Hero from "../components/landing/Hero";
import HowItWorks from "../components/landing/HowItWorks";
import Navbar from "../components/landing/Navbar";
import Pricing from "../components/landing/Pricing";
import Problem from "../components/landing/Problem";
import ProductShowcase from "../components/landing/ProductShowcase";
import Solution from "../components/landing/Solution";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <DashboardPreview />
      <ProductShowcase />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
