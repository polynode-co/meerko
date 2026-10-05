import { Calendar, CodeXml, Database, Mail, MousePointer2, Search, ShieldCheck, Terminal } from "lucide-react";
import { Container } from "../ui/primitives";

const tools = [
  [Terminal, "Claude Code"],
  [MousePointer2, "Cursor"],
  [CodeXml, "Codex"],
  [Mail, "Gmail"],
  [Database, "Apollo"],
  [Search, "Hunter"],
  [ShieldCheck, "ZeroBounce"],
  [Calendar, "Cal.com"],
] as const;

export function WorksWith() {
  return (
    <section className="border-y border-line">
      <Container className="flex flex-col gap-5 py-7 lg:flex-row lg:items-center lg:gap-10">
        <p className="shrink-0 font-mono text-xs tracking-[0.17em] text-muted">WORKS WITH</p>
        <ul className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-4 lg:justify-between">
          {tools.map(([Icon, name]) => (
            <li key={name} className="flex items-center gap-2 text-[15px] font-medium text-muted">
              <Icon className="size-[18px]" />
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
