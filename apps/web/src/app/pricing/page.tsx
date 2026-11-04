import type { Metadata } from "next";
import { LkPage } from "@/components/lookout/kit";
import { PricingPage as Pricing } from "@/components/lookout/marketing/pricing";

export const metadata: Metadata = {
  title: "Meerko pricing: free open-source AI sales agent, Cloud from $49/mo",
  description: "Self-host Meerko free forever, or use Meerko Cloud: start free with 200 credits, then $49/month. Credits only for data lookups.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <LkPage>
      <Pricing />
    </LkPage>
  );
}
