import type { Metadata } from "next";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { AgentSuperpowers } from "@/components/sections/agent-superpowers";
import { FinalCta } from "@/components/sections/final-cta";
import { Footer } from "@/components/sections/footer";
import { faqs, GtmEngineers } from "@/components/sections/gtm-engineers";
import { Hero } from "@/components/sections/hero";
import { Nav } from "@/components/sections/nav";
import { OpenSource } from "@/components/sections/open-source";
import { Problem } from "@/components/sections/problem";
import { WorksWith } from "@/components/sections/works-with";
import { site } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Only facts we can stand behind: no ratings or reviews until there are real ones.
const app = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Meerko",
  description: "The open-source AI sales agent: find leads, enrich them, send cold email from your own Gmail or Outlook and catch every reply, from your terminal or coding agent.",
  url: site.url,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  sameAs: [site.githubUrl],
  offers: [
    { "@type": "Offer", name: "Self-hosted", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Cloud Pro", price: "49", priceCurrency: "USD" },
  ],
};

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <WorksWith />
        <Problem />
        <AgentSuperpowers />
        <OpenSource />
        <GtmEngineers />
        <FinalCta />
      </main>
      <Footer />
      <JsonLd data={app} />
      <JsonLd data={faqJsonLd(faqs)} />
    </>
  );
}
