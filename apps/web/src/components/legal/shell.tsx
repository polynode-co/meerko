import { Mail, type LucideIcon } from "lucide-react";
import { Kicker, LkPage } from "@/components/lookout/kit";
import { LkToc } from "@/components/lookout/marketing/toc";

// The legal pages (/privacy, /terms), from the .pen design "LK · Legal template" (liF7V).

export const LEGAL_UPDATED = "25 November 2026";

/** Who runs Meerko Cloud: the same company as Antwork (its privacy and terms pages say the same). */
export const LEGAL_ENTITY = {
  name: "Polynode Technologies, S.L.",
  address: "C/ Gordoniz 22-7, 48012 Bilbao (Bizkaia), Spain",
  taxId: "ESB75994186",
};

const legalNav: [label: string, href: string][] = [
  ["Privacy policy", "/privacy"],
  ["Terms of service", "/terms"],
  ["Sub-processors", "/privacy#sharing"],
  ["Cookies", "/privacy#cookies"],
];

/** A detail still to be decided (company name, address…), shown so it can't be missed. */
export function Ph({ children }: { children: React.ReactNode }) {
  return <span className="bg-lk-lime/15 px-1 font-plex text-[0.88em] text-lk-lime">[{children}]</span>;
}

export function Section({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4 pt-6">
      <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.5px] text-lk-fg">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[11px] size-1.5 shrink-0 bg-lk-lime" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto outline outline-1 -outline-offset-1 outline-lk-line">
      <table className="w-full text-left text-[15px] leading-[1.55]">
        <thead className="bg-lk-box font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
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
            <tr key={i} className="border-t border-lk-line align-top">
              {r.map((cell, j) => (
                <td key={j} className={`px-[18px] py-3 ${j === 0 ? "font-semibold whitespace-nowrap text-lk-fg" : ""}`}>
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
    <div className="flex gap-3.5 bg-lk-lime/[0.07] px-5 py-[18px] text-[16px] leading-[1.6] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-lime/35">
      <Icon className="mt-1 size-[18px] shrink-0 text-lk-lime" />
      <div>{children}</div>
    </div>
  );
}

export function ContactCard({ title, email }: { title: string; email: string }) {
  return (
    <div className="flex flex-col gap-4 bg-lk-box px-6 py-[22px] outline outline-1 -outline-offset-1 outline-lk-line sm:flex-row sm:items-center sm:gap-5">
      <span className="grid size-11 shrink-0 place-items-center bg-lk-paper">
        <Mail className="size-5 text-lk-ink" />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-[20px] font-semibold text-lk-fg">{title}</p>
        <p className="text-[15px]">
          <a href={`mailto:${email}`} className="font-medium text-lk-lime underline-offset-4 hover:underline">
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

/** Contents on the left (legal menu, then this page's sections), the document on the right. */
export function LegalShell({ title, path, toc, summary, children }: LegalShellProps) {
  return (
    <LkPage>
      <div className="mx-auto flex w-full max-w-[1440px] gap-[72px] px-6 pt-14 pb-24 lg:px-36 lg:pt-20">
        <aside className="hidden w-[260px] shrink-0 lg:block">
          <div className="sticky top-[calc(var(--lk-nav-h)+2rem)] flex max-h-[calc(100dvh-var(--lk-nav-h)-4rem)] flex-col gap-9 overflow-y-auto pb-4">
            <nav aria-label="Legal" className="flex flex-col gap-1.5">
              <p className="mb-1 font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">Legal</p>
              {legalNav.map(([label, href]) => {
                const on = href === path;
                return (
                  <a
                    key={label}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`text-[15px] ${on ? "font-semibold text-lk-lime" : "text-lk-muted hover:text-lk-fg"}`}
                  >
                    {label}
                  </a>
                );
              })}
            </nav>
            <LkToc items={toc.map(([id, label], i) => [id, `${i + 1}. ${label}`] as [string, string])} />
          </div>
        </aside>

        <article className="flex max-w-[820px] min-w-0 flex-1 flex-col gap-[22px] text-[17px] leading-[1.65] text-lk-muted">
          <header className="flex flex-col gap-4">
            <Kicker as="p">Legal</Kicker>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[52px] sm:tracking-[-1.9px]">{title}</h1>
            <p className="flex flex-col gap-1 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase sm:flex-row sm:gap-x-5">
              <span>Last updated {LEGAL_UPDATED}</span>
              <span>Covers Meerko Cloud, not self-hosted installs</span>
            </p>
          </header>

          <div className="flex flex-col gap-5 bg-lk-box px-6 py-6 outline outline-1 -outline-offset-1 outline-lk-line sm:px-7">
            <p className="font-plex text-[12.5px] tracking-[0.8px] text-lk-lime uppercase">The short version</p>
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {summary.map(([Icon, t, body]) => (
                <div key={t} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center bg-lk-paper">
                    <Icon className="size-4 text-lk-ink" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-[15.5px] leading-snug font-semibold text-lk-fg">{t}</p>
                    <p className="text-[15px] leading-[1.55]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {children}
        </article>
      </div>
    </LkPage>
  );
}
