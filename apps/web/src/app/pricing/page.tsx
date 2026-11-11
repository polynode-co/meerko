import type { Metadata } from "next";
import { LkPage } from "@/components/lookout/kit";
import { PricingPage as Pricing } from "@/components/lookout/marketing/pricing";

export const metadata: Metadata = {
  title: "Meerko pricing: start free, Pro $49/mo or $490/yr",
  description: "Meerko Cloud starts free with 200 credits and 1 mailbox; Pro is $49 a month or $490 a year. Credits only for data lookups, misses free. Or self-host it for free.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <LkPage>
      <Pricing />
    </LkPage>
  );
}
