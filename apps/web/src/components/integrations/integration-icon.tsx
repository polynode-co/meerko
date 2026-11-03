import { Braces, Database, Flame, Mail, MessageSquare, Terminal, Webhook, type LucideIcon } from "lucide-react";
import Image from "next/image";
import type { Integration } from "@/lib/integrations";

// Product logos only where we already ship them (public/logos/agents); everything else gets a plain icon.
const icons: Record<string, LucideIcon> = {
  gmail: Mail,
  outlook: Mail,
  imap: Mail,
  icypeas: Database,
  firecrawl: Flame,
  slack: MessageSquare,
  webhooks: Webhook,
  api: Braces,
  cli: Terminal,
};

export function IntegrationIcon({ i, size = 44 }: { i: Integration; size?: number }) {
  const Icon = icons[i.slug] ?? Terminal;
  return (
    <span className="grid shrink-0 place-items-center rounded-xl border border-line bg-ink" style={{ width: size, height: size }}>
      {i.logo ? (
        <Image src={i.logo} alt={`${i.name} logo`} width={size * 0.55} height={size * 0.55} className={i.mono ? "invert" : ""} />
      ) : (
        <Icon className="text-accent" style={{ width: size * 0.45, height: size * 0.45 }} />
      )}
    </span>
  );
}
