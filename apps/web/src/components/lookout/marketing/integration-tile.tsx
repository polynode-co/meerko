import { Braces, Mail, Terminal, Webhook, type LucideIcon } from "lucide-react";
import Image from "next/image";
import type { Integration } from "@/lib/integrations";

// Brand logos live in public/logos (agents/ and integrations/). What isn't a brand (webhooks, the API,
// the CLI) gets a plain icon.
const icons: Record<string, LucideIcon> = {
  webhooks: Webhook,
  api: Braces,
  cli: Terminal,
};

/** A paper tile with the integration's logo (two logos share the tile diagonally), or an ink icon. */
export function IntegrationTile({ i, size = 36 }: { i: Integration; size?: number }) {
  const logos = i.logos ?? (i.logo ? [i.logo] : []);
  const Icon = icons[i.slug] ?? Mail;
  const one = Math.round(size * 0.6);
  const two = Math.round(size * 0.46);
  return (
    <span className="relative grid shrink-0 place-items-center bg-lk-paper" style={{ width: size, height: size }}>
      {logos.length > 1 ? (
        // two providers share one tile: one mark top-left, the other bottom-right
        logos.slice(0, 2).map((src, n) => (
          <Image key={src} src={src} alt="" width={two} height={two} className={`absolute object-contain ${n ? "right-[10%] bottom-[10%]" : "top-[10%] left-[10%]"}`} />
        ))
      ) : logos.length ? (
        <Image src={logos[0]} alt="" width={one} height={one} className="rounded-[3px] object-contain" />
      ) : (
        <Icon className="text-lk-ink" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}
