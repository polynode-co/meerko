import { type LucideIcon, ShieldCheck, Terminal } from "lucide-react";

/** A section heading that "On this page" links to. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-4 font-display text-[26px] leading-tight font-bold tracking-[-0.01em] text-fg">
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-24 pt-1 text-lg font-semibold text-fg">
      {children}
    </h3>
  );
}

/** An MCP tool name, linking to its reference entry. */
export function Tool({ name }: { name: string }) {
  return (
    <a href={`/docs/mcp-tools#${name}`} className="font-mono text-[0.92em] text-accent hover:underline">
      {name}
    </a>
  );
}

/** Inline code. */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.92em] text-fg">{children}</code>;
}

/** An in-text link. */
export function L({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-accent underline-offset-2 hover:underline" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

export function Callout({ icon: Icon = ShieldCheck, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-accent/25 bg-accent-soft px-[18px] py-4 text-[15px] leading-normal text-fg">
      <Icon className="mt-0.5 size-[18px] shrink-0 text-accent" />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/** A two-column table: mono keys on the left. */
export function Fields({ head, rows }: { head: [string, string]; rows: [key: React.ReactNode, value: React.ReactNode][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-[15px]">
        <thead className="bg-raised font-mono text-[11px] tracking-[0.1em] uppercase">
          <tr>
            <th className="px-[18px] py-3 font-normal">{head[0]}</th>
            <th className="px-[18px] py-3 font-normal">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-t border-line align-top">
              <td className="px-[18px] py-3 font-mono text-[13.5px] whitespace-nowrap text-accent">{k}</td>
              <td className="px-[18px] py-3 leading-normal text-fg">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A row of key facts (e.g. defaults). */
export function Facts({ items }: { items: [label: string, value: string, note: React.ReactNode][] }) {
  return (
    <div className={`grid gap-3.5 ${items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {items.map(([label, value, note]) => (
        <div key={label} className="flex flex-col gap-1.5 rounded-xl border border-line px-[18px] py-4">
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase">{label}</p>
          <p className="font-display text-[22px] font-bold text-fg">{value}</p>
          <p className="text-[15px] leading-normal">{note}</p>
        </div>
      ))}
    </div>
  );
}

/** A numbered how-to step. */
export function Step({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3.5 pt-3">
      <h2 className="flex items-center gap-3 font-display text-[22px] font-bold text-fg">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[13px] text-accent">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A list with an icon per item. */
export function IconList({ icon: Icon, items }: { icon: LucideIcon; items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-fg">
          <Icon className="mt-[5px] size-4 shrink-0 text-muted" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two or three cards side by side, each with an icon. */
export function Cards({ items }: { items: [icon: LucideIcon, title: string, body: React.ReactNode][] }) {
  return (
    <div className={`grid gap-3.5 ${items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {items.map(([Icon, title, body]) => (
        <div key={title} className="flex gap-3.5 rounded-xl border border-line bg-raised p-[18px]">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-accent-soft">
            <Icon className="size-[17px] text-accent" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-fg">{title}</p>
            <div className="text-[15px] leading-normal">{body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Ask your agent": an example prompt. */
export function AskAgent({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-accent/25 bg-accent-soft px-5 py-[18px]">
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
        <Terminal className="size-3.5" /> In Claude Code
      </p>
      <p className="font-mono text-[14px] leading-[1.55] text-fg">› {children}</p>
    </div>
  );
}
