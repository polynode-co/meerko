import { type LucideIcon, ShieldCheck } from "lucide-react";
import { Window } from "@/components/lookout/kit";

// The pieces docs pages are written with, in Lookout style (.pen "LK · Docs article template", pnGLf).

/** A section heading that "On this page" links to. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-6 font-sans text-[26px] leading-tight font-semibold tracking-[-0.8px] text-lk-fg sm:text-[28px]">
      {children}
    </h2>
  );
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-24 pt-1 text-[19px] font-semibold tracking-[-0.3px] text-lk-fg">
      {children}
    </h3>
  );
}

/** An MCP tool name, linking to its reference entry. */
export function Tool({ name }: { name: string }) {
  return (
    <a href={`/docs/mcp-tools#${name}`} className="font-plex text-[0.9em] text-lk-lime underline-offset-4 hover:underline">
      {name}
    </a>
  );
}

/** Inline code. */
export function C({ children }: { children: React.ReactNode }) {
  return <code className="bg-lk-frame px-1 py-px font-plex text-[0.9em] break-words text-lk-fg">{children}</code>;
}

/** An in-text link. */
export function L({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-lk-lime underline decoration-lk-lime/40 underline-offset-4 hover:decoration-lk-lime"
      {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </a>
  );
}

/** Lime-tinted note with an icon. */
export function Callout({ icon: Icon = ShieldCheck, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-lk-lime/[0.07] px-4 py-3.5 text-[15.5px] leading-[1.6] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-lime/35">
      <Icon className="mt-[3px] size-4 shrink-0 text-lk-lime" />
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

/** A two-column table: mono keys on the left. Scrolls sideways inside its frame on small screens. */
export function Fields({ head, rows }: { head: [string, string]; rows: [key: React.ReactNode, value: React.ReactNode][] }) {
  return (
    <div className="overflow-x-auto outline outline-1 -outline-offset-1 outline-lk-line">
      <table className="w-full text-left text-[15px]">
        <thead className="bg-lk-box font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">
          <tr>
            <th className="px-4 py-3 font-normal">{head[0]}</th>
            <th className="px-4 py-3 font-normal">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-t border-lk-line align-top">
              <td className="px-4 py-3 font-plex text-[13.5px] whitespace-nowrap text-lk-lime">{k}</td>
              <td className="min-w-[200px] px-4 py-3 leading-[1.55] text-lk-fg">{v}</td>
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
        <div key={label} className="flex flex-col gap-2 bg-lk-box px-[18px] py-4 outline outline-1 -outline-offset-1 outline-lk-line">
          <p className="font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">{label}</p>
          <p className="font-pixel text-[22px] text-lk-lime">{value}</p>
          <p className="text-[15px] leading-[1.55]">{note}</p>
        </div>
      ))}
    </div>
  );
}

/** A numbered how-to step: lime number square, a rule above. */
export function Step({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-2 flex scroll-mt-24 gap-4 border-t border-lk-line pt-[18px] sm:gap-[18px]">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center bg-lk-lime font-pixel text-[15px] text-lk-ink">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h2 className="pt-0.5 text-[22px] leading-[28px] font-semibold tracking-[-0.6px] text-lk-fg">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

/** A list with an icon per item. */
export function IconList({ icon: Icon, items }: { icon: LucideIcon; items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-lk-fg">
          <Icon className="mt-[5px] size-4 shrink-0 text-lk-lime" />
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
        <div key={title} className="flex flex-col gap-2.5 bg-lk-box p-[18px] outline outline-1 -outline-offset-1 outline-lk-line">
          <span className="grid size-8 shrink-0 place-items-center bg-lk-lime/[0.1] outline outline-1 -outline-offset-1 outline-lk-lime/35">
            <Icon className="size-4 text-lk-lime" />
          </span>
          <p className="font-semibold text-lk-fg">{title}</p>
          <div className="text-[15px] leading-[1.55]">{body}</div>
        </div>
      ))}
    </div>
  );
}

/** "Ask your agent": an example prompt, in a paper window. */
export function AskAgent({ children }: { children: string }) {
  return (
    <Window title="IN CLAUDE CODE" className="my-1 mr-2.5" bodyClassName="px-[18px] py-4">
      <p className="font-plex text-[14px] leading-[1.6] break-words text-lk-ink">› {children}</p>
    </Window>
  );
}
