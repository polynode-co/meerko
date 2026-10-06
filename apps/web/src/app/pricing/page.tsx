import type { Metadata } from "next";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { CreditCosts, Pricing, PricingFaq } from "@/components/sections/pricing";

export const metadata: Metadata = {
  title: "Pricing — Meerko",
  description: "Self-host Meerko free forever, or use Meerko Cloud: start free with 1,000 credits, then $49/month. Credits only for data lookups and AI.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main>
        <Pricing />
        <CreditCosts />
        <PricingFaq />
      </main>
      <Footer />
    </>
  );
}
