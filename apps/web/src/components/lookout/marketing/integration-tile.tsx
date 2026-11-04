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

/** A paper tile with the integration's logo (black marks sit on paper as they are) or an ink icon. */
export function IntegrationTile({ i, size = 36 }: { i: Integration; size?: number }) {
  const Icon = icons[i.slug] ?? Terminal;
  return (
    <span className="grid shrink-0 place-items-center bg-lk-paper" style={{ width: size, height: size }}>
      {i.logo ? (
        <Image src={i.logo} alt={`${i.name} logo`} width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} />
      ) : (
        <Icon className="text-lk-ink" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}
