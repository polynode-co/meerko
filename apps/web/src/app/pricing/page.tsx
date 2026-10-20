import type { Metadata } from "next";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { CreditCosts, Pricing, PricingFaq, pricingFaq } from "@/components/sections/pricing";

export const metadata: Metadata = {
  title: "Meerko pricing: free open-source AI sales agent, Cloud from $49/mo",
  description: "Self-host Meerko free forever, or use Meerko Cloud: start free with 200 credits, then $49/month. Credits only for data lookups.",
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
        <JsonLd data={faqJsonLd(pricingFaq)} />
      </main>
      <Footer />
    </>
  );
}
