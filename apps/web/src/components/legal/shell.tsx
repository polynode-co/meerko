import { Calendar, Cloud, Cookie, FileText, Mail, PencilLine, Server, Shield, type LucideIcon } from "lucide-react";
import { Toc } from "@/components/content/client";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";

export const LEGAL_UPDATED = "13 October 2026";

/** Who runs Meerko Cloud: the same company as Antwork (its privacy and terms pages say the same). */
export const LEGAL_ENTITY = {
  name: "Polynode Technologies, S.L.",
  address: "C/ Gordoniz 22-7, 48012 Bilbao (Bizkaia), Spain",
  taxId: "ESB75994186",
};

const legalNav: [label: string, href: string, icon: LucideIcon][] = [
  ["Privacy policy", "/privacy", Shield],
  ["Terms of service", "/terms", FileText],
  ["Sub-processors", "/privacy#sharing", Server],
  ["Cookies", "/privacy#cookies", Cookie],
];

/** A detail still to be decided (company name, address…), shown so it can't be missed. */
export function Ph({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-accent-soft px-1 font-mono text-[0.88em] text-accent">[{children}]</span>;
}

export function Section({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4 pt-4">
      <h2 className="flex items-baseline gap-3 font-display text-[26px] font-bold tracking-[-0.01em] text-fg">
        <span className="font-mono text-sm font-normal text-accent">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15.5px]">
          <span className="mt-[10px] size-[5px] shrink-0 rounded-full bg-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-[14.5px]">
        <thead className="bg-raised font-mono text-[11px] tracking-[0.1em] uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-[18px] py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((cell, j) => (
                <td key={j} className={`px-[18px] py-3 leading-normal ${j === 0 ? "font-semibold whitespace-nowrap text-fg" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-accent/25 bg-accent-soft px-5 py-[18px] text-[15.5px] leading-[1.55] text-fg">
      <Icon className="mt-0.5 size-[18px] shrink-0 text-accent" />
      <div>{children}</div>
    </div>
  );
}

export function ContactCard({ title, email }: { title: string; email: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-raised px-6 py-[22px] sm:flex-row sm:items-center sm:gap-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft">
        <Mail className="size-5 text-accent" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-display text-xl font-bold text-fg">{title}</p>
        <p className="text-sm">
          <a href={`mailto:${email}`} className="font-medium text-accent underline-offset-2 hover:underline">
            {email}
          </a>{" "}
          · {LEGAL_ENTITY.name}, {LEGAL_ENTITY.address}
        </p>
      </div>
    </div>
  );
}

export interface LegalShellProps {
  title: string;
  path: string;
  toc: [id: string, label: string][];
  summary: [icon: LucideIcon, title: string, body: string][];
  children: React.ReactNode;
}

/** The legal pages' layout from the Pencil design: legal menu, "On this page", the short version, then sections. */
export function LegalShell({ title, path, toc, summary, children }: LegalShellProps) {
  return (
    <>
      <Nav />
      <main>
        <Container className="flex gap-[72px] pt-14 pb-24">
          <aside className="hidden w-[240px] shrink-0 lg:block">
            <div className="sticky top-24 flex flex-col gap-8">
              <nav aria-label="Legal" className="flex flex-col gap-0.5">
                <p className="mb-1.5 font-mono text-[11px] tracking-[0.15em] text-muted uppercase">Legal</p>
                {legalNav.map(([label, href, Icon]) => {
                  const on = href === path;
                  return (
                    <a
                      key={label}
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${on ? "bg-accent-soft font-semibold text-accent" : "text-fg hover:text-accent"}`}
                    >
                      <Icon className={`size-[15px] ${on ? "" : "text-muted"}`} /> {label}
                    </a>
                  );
                })}
              </nav>
              <Toc items={toc.map(([id, label], i) => [id, `${i + 1}. ${label}`] as [string, string])} />
            </div>
          </aside>

          <article className="flex max-w-[860px] min-w-0 flex-1 flex-col gap-7 text-base leading-[1.65] text-muted">
            <header className="flex flex-col gap-3.5">
              <p className="font-mono text-xs tracking-[0.15em] text-accent uppercase">Legal</p>
              <h1 className="font-display text-5xl font-bold tracking-[-0.03em] text-fg lg:text-[52px]">{title}</h1>
              <p className="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> Last updated {LEGAL_UPDATED}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Cloud className="size-3.5" /> Covers Meerko Cloud, not self-hosted installs
                </span>
              </p>
            </header>

            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-raised px-[26px] py-6">
              <p className="font-mono text-[11px] tracking-[0.15em] text-accent uppercase">The short version</p>
              <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                {summary.map(([Icon, t, body]) => (
                  <div key={t} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
                      <Icon className="size-4 text-accent" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <p className="text-[15px] leading-snug font-semibold text-fg">{t}</p>
                      <p className="text-[13.5px] leading-normal">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="flex items-center gap-3 rounded-[10px] border border-accent/35 px-4 py-3 text-[13.5px] text-fg">
              <PencilLine className="size-4 shrink-0 text-accent" />
              Fields in [brackets] are filled in once the company details are final.
            </p>

            {children}
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}
