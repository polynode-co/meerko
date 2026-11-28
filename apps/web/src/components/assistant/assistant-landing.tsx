import { ArrowUpRight, Check, Plus, X } from "lucide-react";
import { STAGES } from "@meerko/sdk";
import { JsonLd } from "@/components/json-ld";
import { LookoutCommand } from "@/components/lookout/copy-command";
import { CtaBand, GhostButton, Kicker, LimeButton, LkPage, Window } from "@/components/lookout/kit";
import { IntegrationTile } from "@/components/lookout/marketing/integration-tile";
import { FaqGrid, LkBreadcrumbs, SourceList, citer, wrap } from "@/components/lookout/marketing/ui";
import { LogoMark } from "@/components/ui/brand";
import { approvalFact, assistantPages, type AssistantPage, type AssistantSlug } from "@/lib/assistant-pages";
import { toolByName } from "@/lib/docs";
import { integrationBySlug } from "@/lib/integrations";
import { mcpUrl } from "@/lib/meerko";
import { FREE_CREDITS } from "@/lib/pricing";
import { site } from "@/lib/site";

// "Claude for sales" (/claude), "ChatGPT for sales" (/chatgpt), the Perplexity plugin (/perplexity) and the Mistral Vibe
// connector (/mistral), in the landing's Lookout kit (Landing v2.1): the
// hero with a chat window, then one band per question a searcher has, in the order they have it. The same sequence
// as Antwork's /automate/<client>/<platform> leaves: the answer, the setup, what to ask, what it can and can't do, FAQ.
// The copy lives in lib/assistant-pages.ts.

const title = "text-[28px] leading-[1.1] font-semibold tracking-[-0.9px] text-lk-fg sm:text-[40px] sm:tracking-[-1.3px]";
const sub = "max-w-[760px] text-[16px] leading-[1.6] text-lk-muted sm:text-[17px]";
const box = "bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line";
const link = "text-lk-lime underline-offset-4 hover:underline";

/** The clients /docs/mcp-clients covers, named under "Other AI clients" (less the page's own). */
const otherClients = ["Gemini CLI", "Muse", "Mistral Vibe", "Perplexity"];

/** The most steps a sequence takes, from the MCP server's own schema. */
const maxSteps = (toolByName("manage_sequence").inputSchema as { properties: { steps: { maxItems: number } } }).properties.steps.maxItems;

function Band({ id, kicker, heading, intro, children }: { id?: string; kicker: string; heading: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={`${wrap} flex scroll-mt-20 flex-col gap-7 pt-16 lg:gap-10 lg:pt-24`}>
      <div className="flex flex-col gap-3.5">
        <Kicker>{kicker}</Kicker>
        <h2 id={id ? `${id}-title` : undefined} className={`${title} max-w-[960px]`}>
          {heading}
        </h2>
        {intro && <p className={sub}>{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function ChatWindow({ p }: { p: AssistantPage }) {
  return (
    // An illustration of a chat, not a recording: hidden from screen readers like the landing's windows.
    <div aria-hidden className="w-full min-w-0 lg:w-[500px] lg:shrink-0">
      <Window title={p.chat.window} bodyClassName="flex flex-col gap-3.5 p-4 lg:p-5">
        <p className="self-end bg-lk-ink px-3.5 py-2.5 text-[14.5px] leading-[1.45] text-lk-paper lg:max-w-[88%]">{p.chat.prompt}</p>
        <ul className="flex flex-wrap gap-2">
          {p.chat.tools.map((t) => (
            <li key={t} className="flex items-center gap-1.5 px-2 py-1 font-plex text-[11.5px] text-lk-ink outline outline-1 -outline-offset-1 outline-lk-ink/40">
              <LogoMark size={13} /> Meerko · {t}
            </li>
          ))}
        </ul>
        <p className="text-[14.5px] leading-[1.5] text-lk-ink">{p.chat.reply}</p>
        <div className="flex flex-wrap gap-2 pt-1 font-plex text-[12px]">
          <span className="bg-lk-ink px-3 py-2 text-lk-lime">Write the sequence</span>
          <span className="px-3 py-2 text-lk-ink outline outline-1 -outline-offset-1 outline-lk-ink">Show the table</span>
        </div>
      </Window>
    </div>
  );
}

export function AssistantLanding({ slug }: { slug: AssistantSlug }) {
  const p = assistantPages[slug];
  const other = Object.values(assistantPages).find((x) => x.slug !== slug)!;
  const url = mcpUrl();
  const Cite = citer(p.sources);
  const facts = [...p.only, approvalFact];
  const pageUrl = new URL(`/${slug}`, site.url).toString();

  const can = [
    "Find people and companies, then find and verify their work emails",
    `Write and send sequences of up to ${maxSteps} emails from your own mailbox, follow-ups in the same thread`,
    "Spot replies, bounces, out-of-office answers and unsubscribes, and stop the sequence for that person",
    "Sort replies and draft answers for you to approve",
    `Track every lead through the pipeline (${STAGES.join(", ")}) and push contacts to HubSpot or Attio`,
  ];
  const cannot = [
    "Send LinkedIn messages or make calls: Meerko works over email",
    "Attach files: sequence emails are plain text",
    "Read or change deals in your CRM: the sync only writes contacts",
  ];

  return (
    <LkPage>
      {/* ---------------------------------------------------------------- hero */}
      <section className={`${wrap} flex flex-col gap-12 pt-10 pb-4 lg:flex-row lg:items-center lg:gap-[72px] lg:pt-14`}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <LkBreadcrumbs items={[["Home", "/"], [`${p.name} for sales`, `/${slug}`]]} />
          <p className="flex flex-wrap items-center gap-3 pt-3">
            <span className="flex items-center gap-3">
              <IntegrationTile i={integrationBySlug(p.integration)} size={44} />
              <Plus aria-hidden className="size-3.5 text-lk-dim" />
              <span className="grid size-11 place-items-center bg-lk-paper">
                <LogoMark size={26} />
              </span>
            </span>
            <span className="font-plex text-[13px] tracking-[0.8px] text-lk-lime uppercase">{p.name} for sales · Meerko</span>
          </p>
          <h1 className="text-[36px] leading-[1.08] font-semibold tracking-[-1.3px] text-lk-fg sm:text-[48px] sm:tracking-[-1.8px]">{p.h1}</h1>
          <p className="text-[17px] leading-[1.6] text-lk-muted">{p.lede}</p>
          <div className="flex flex-wrap gap-4 pt-2">
            <LimeButton href={p.cta.href}>{p.cta.label}</LimeButton>
            <GhostButton href="#setup">See the setup ↓</GhostButton>
          </div>
          <p className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">
            {FREE_CREDITS} free credits · Open source, AGPL-3.0 ·{" "}
            <a href={p.docs} className="hover:text-lk-fg">
              Setup docs →
            </a>
          </p>
        </div>
        <ChatWindow p={p} />
      </section>

      {/* ------------------------------------------------- the short answer */}
      <Band kicker="The short answer" heading={p.question}>
        <div className={`${box} flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:gap-10`}>
          <p className="min-w-0 flex-1 text-[17px] leading-[1.65] text-lk-fg">{p.answer}</p>
          <ul className="flex shrink-0 flex-col gap-4 lg:w-[400px] lg:border-l lg:border-lk-line lg:pl-8">
            {facts.map((f) => (
              <li key={f.title} className="flex gap-3">
                <Check aria-hidden className="mt-[3px] size-[18px] shrink-0 text-lk-lime" />
                <span className="flex flex-col gap-1">
                  <span className="text-[15.5px] font-semibold text-lk-fg">
                    {f.title}
                    {f.source ? <Cite s={f.source} /> : null}
                  </span>
                  <span className="text-[14.5px] leading-[1.5] text-lk-muted">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      {/* ------------------------------------------------------------ setup */}
      <Band id="setup" kicker="Set it up" heading={p.setup.title} intro={p.setup.sub}>
        <ol className={`grid gap-5 md:grid-cols-2 ${p.setup.steps.length === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
          {p.setup.steps.map((s, k) => (
            <li key={s.title} className={`${box} flex min-w-0 flex-col gap-3 p-6`}>
              <span className="font-pixel text-[14px] text-lk-lime">{String(k + 1).padStart(2, "0")}</span>
              <span className="text-[19px] font-semibold text-lk-fg">{s.title}</span>
              <span className="text-[15px] leading-[1.6] text-lk-muted">{s.body}</span>
              {s.copyUrl && (
                <div className="mt-auto">
                  <LookoutCommand command={url} prefix="" label="Copy server URL" />
                </div>
              )}
              {s.link && (
                <a href={s.link.href} target="_blank" rel="noopener" className={`mt-auto inline-flex items-center gap-1 font-plex text-[13px] tracking-[0.6px] uppercase ${link}`}>
                  {s.link.label} <ArrowUpRight aria-hidden className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ol>
        {p.setup.after && (
          <p className="max-w-[860px] text-[15.5px] leading-[1.6] text-lk-muted">
            {p.setup.after}
            {p.setup.afterLink && (
              <>
                {" "}
                <a href={p.setup.afterLink.href} target="_blank" rel="noopener" className={link}>
                  {p.setup.afterLink.label} →
                </a>
              </>
            )}
          </p>
        )}
        <div className="flex flex-col gap-4 border border-dashed border-lk-gray p-6">
          <h3 className="text-[18px] font-semibold text-lk-fg">{p.alt.title}</h3>
          <p className="text-[15.5px] leading-[1.6] text-lk-muted">{p.alt.body}</p>
          {p.alt.command && <LookoutCommand command={p.alt.command.replace("{url}", url)} />}
          {p.alt.also && (
            <>
              <p className="text-[15.5px] leading-[1.6] text-lk-muted">{p.alt.also.body}</p>
              <LookoutCommand command={p.alt.also.command} />
            </>
          )}
          <a href={p.alt.link.href} className={`w-fit font-plex text-[13px] tracking-[0.6px] uppercase ${link}`}>
            {p.alt.link.label} →
          </a>
        </div>
      </Band>

      {/* ---------------------------------------------------------- prompts */}
      <Band id="prompts" kicker="What you ask" heading={`What to ask ${p.name} once Meerko is connected`} intro="Plain language is enough. These are starting points: change the titles, places and numbers to your own.">
        <div className="grid gap-5 md:grid-cols-2">
          {p.prompts.map((g) => (
            <div key={g.group} className={`${box} flex flex-col gap-4 p-6`}>
              <div className="flex flex-col gap-1">
                <h3 className="font-pixel text-[15px] tracking-[1px] text-lk-fg uppercase">{g.group}</h3>
                <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">{g.query}</span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {g.items.map((q) => (
                  <li key={q} className="bg-lk-bg px-3.5 py-3 font-plex text-[13.5px] leading-[1.55] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-line">
                    › {q}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Band>

      {/* ---------------------------------------------- your inbox, your CRM */}
      <Band id="inbox" kicker="Your inbox · your CRM" heading="It sends from your own mailbox and keeps the pipeline">
        <div className="grid gap-5 md:grid-cols-2">
          <div className={`${box} flex flex-col gap-3 p-6`}>
            <h3 className="text-[19px] font-semibold text-lk-fg">Gmail, Outlook or any IMAP inbox</h3>
            <p className="text-[15.5px] leading-[1.6] text-lk-muted">
              Gmail and Google Workspace connect with an app password; Outlook and Microsoft 365 with Sign in with Microsoft. Each mailbox
              has a daily limit (50 by default) and waits 3 to 7 minutes between sends. On Meerko Cloud, Meerko checks for replies every
              minute, even with {p.name} closed.
            </p>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
              <a href="/integrations/gmail" className={link}>Gmail →</a>
              <a href="/integrations/outlook" className={link}>Outlook →</a>
              <a href="/docs/mailboxes" className={link}>Mailboxes →</a>
            </p>
          </div>
          <div className={`${box} flex flex-col gap-3 p-6`}>
            <h3 className="text-[19px] font-semibold text-lk-fg">A pipeline, and HubSpot or Attio</h3>
            <p className="text-[15.5px] leading-[1.6] text-lk-muted">
              Every lead has a stage ({STAGES.join(", ")}) that moves on its own when Meerko emails them and when they reply, and that{" "}
              {p.name} can move when you ask. Connect HubSpot or Attio and contacted leads go there as contacts, one way.
            </p>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
              <a href="/docs/pipeline" className={link}>Pipeline →</a>
              <a href="/docs/crm" className={link}>CRM sync →</a>
            </p>
          </div>
        </div>
      </Band>

      {/* ---------------------------------------------------- can / cannot */}
      <Band id="does" kicker="What it does" heading={`What ${p.name} can and can't do with Meerko`}>
        <div className="grid gap-5 md:grid-cols-2">
          {[
            { head: "Can", items: can, ok: true },
            { head: "Can't", items: cannot, ok: false },
          ].map((col) => (
            <div key={col.head} className={`flex flex-col gap-4 p-6 outline outline-1 -outline-offset-1 ${col.ok ? "bg-lk-box outline-lk-lime/40" : "outline-lk-line"}`}>
              <h3 className="font-pixel text-[15px] tracking-[1px] text-lk-fg uppercase">{col.head}</h3>
              <ul className="flex flex-col gap-3">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[15.5px] leading-[1.5] text-lk-fg">
                    {col.ok ? (
                      <Check aria-hidden className="mt-[3px] size-4 shrink-0 text-lk-lime" />
                    ) : (
                      <X aria-hidden className="mt-[3px] size-4 shrink-0 text-lk-dim" />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Band>

      {/* --------------------------------------------------------------- FAQ */}
      <Band id="faq" kicker="Questions" heading={`${p.name} for sales: questions`}>
        <FaqGrid items={p.faq} />
      </Band>

      {/* ----------------------------------------------------------- related */}
      <section className={`${wrap} flex flex-col gap-6 pt-16 pb-16 lg:pt-24`}>
        <Kicker>Keep going</Kicker>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: `/${other.slug}`, name: `${other.name} for sales`, text: `The same, from ${other.name}.` },
            { href: p.docs, name: `${p.name} setup docs`, text: "Every step, and how to disconnect." },
            p.guide
              ? { href: p.guide.href, name: p.guide.label, text: "What connectors are and how they work." }
              : { href: "/docs/mcp-clients", name: "Other AI clients", text: `${otherClients.filter((n) => n !== p.name).slice(0, 3).join(", ")} and more.` },
            { href: "/docs/mcp-tools", name: "All the tools", text: `What ${p.name} can call, one by one.` },
          ].map((r) => (
            <li key={r.href}>
              <a href={r.href} className="flex h-full flex-col gap-1 px-4 py-3.5 outline outline-1 -outline-offset-1 outline-lk-line transition hover:bg-lk-box">
                <span className="text-[15.5px] font-semibold text-lk-fg">{r.name} →</span>
                <span className="text-[14.5px] text-lk-muted">{r.text}</span>
              </a>
            </li>
          ))}
        </ul>
        <SourceList sources={p.sources} />
      </section>

      <CtaBand
        title={`Run your outbound from ${p.name}`}
        body={`Meerko finds the leads, sends from your own Gmail or Outlook and stops the sequence when someone replies. Start free with ${FREE_CREDITS} credits, or self-host it.`}
        cta={p.cta.label}
        href={p.cta.href}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: p.setup.title,
          description: p.answer,
          step: p.setup.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
        }}
      />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebPage", name: p.title, description: p.description, url: pageUrl, inLanguage: "en" }} />
    </LkPage>
  );
}
