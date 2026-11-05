import { ChevronDown, ShieldCheck } from "lucide-react";
import { OpenOnHash } from "@/components/lookout/docs/search";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, L } from "@/components/lookout/docs/ui";
import { type McpTool, cantUndo, docHref, mcp, needsApproval, toolByName, toolGroups, toolParams } from "@/lib/docs";

export const metadata = docsMetadata("mcp-tools", "Meerko MCP tools reference | Meerko docs");

// Ids are explained by where they come from; everything else is described in the server's own schema.
const idSource: Record<string, string> = {
  table_id: "A table's id, from list_tables.",
  sequence_id: "From list_sequences.",
  mailbox_id: "From list_mailboxes.",
  reply_id: "From list_replies.",
  draft_id: "From list_drafts.",
  row_id: "A row's id, from query_rows.",
  row_ids: "Row ids, from query_rows.",
};

function ToolEntry({ tool }: { tool: McpTool }) {
  const [first, ...rest] = tool.description.split("\n");
  const { params, nested } = toolParams(tool);
  return (
    <details id={tool.name} className="group scroll-mt-24 border-t border-line first:border-t-0 open:bg-raised">
      <summary className="flex cursor-pointer list-none items-start gap-4 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="w-[170px] shrink-0 pt-px font-mono text-[13.5px] text-accent">{tool.name}</span>
        <span className="min-w-0 flex-1 text-[15px] leading-normal">{first}</span>
        {needsApproval(tool) && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[12px] text-accent sm:inline-flex">
            <ShieldCheck className="size-3" /> sends email · needs your OK
          </span>
        )}
        {cantUndo(tool) && (
          <span className="hidden shrink-0 rounded-full bg-ink px-2 py-0.5 font-mono text-[12px] sm:inline-flex">can&apos;t undo</span>
        )}
        {tool.annotations.readOnlyHint && <span className="hidden shrink-0 rounded-full bg-ink px-2 py-0.5 font-mono text-[12px] sm:inline-flex">read-only</span>}
        <ChevronDown className="mt-1 size-3.5 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 px-[18px] pb-5">
        {rest.length > 0 && <p className="text-[15px] leading-[1.55] whitespace-pre-line">{rest.join("\n")}</p>}
        {[{ of: "", params }, ...nested].map(({ of, params: ps }) => (
          <div key={of} className="flex flex-col gap-2">
            <p className="font-mono text-[12px] tracking-[0.14em] uppercase">{of ? `Each item in ${of}` : "Parameters"}</p>
            {ps.length === 0 ? (
              <p className="text-sm">None.</p>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-line">
                <table className="w-full text-left text-[13.5px]">
                  <tbody>
                    {ps.map((p) => (
                      <tr key={p.name} className="border-t border-line align-top first:border-t-0">
                        <td className="px-3.5 py-2.5 font-mono whitespace-nowrap text-fg">{p.name}</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs whitespace-nowrap">{p.type}</td>
                        <td className="px-3.5 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 font-mono text-[12px] ${p.required ? "bg-accent-soft text-accent" : "bg-ink"}`}>
                            {p.required ? "required" : "optional"}
                          </span>
                        </td>
                        <td className="min-w-[220px] px-3.5 py-2.5 leading-[1.45]">{p.description || idSource[p.name] || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Page() {
  return (
    <DocsShell
      slug="mcp-tools"
      lead={
        <p>
          Everything your agent can call once the Meerko MCP server is connected: {mcp.tools.length} tools and {mcp.prompts.length}{" "}
          commands. This page is generated from the server&apos;s own definitions, so it matches what your agent sees.
        </p>
      }
      toc={[...toolGroups.map((g) => [g.id, g.label] as [string, string]), ["commands", "Commands"]]}
    >
      <OpenOnHash />
      <Callout>
        <p>
          {mcp.tools.filter(needsApproval).map((t, i, all) => (
            <span key={t.name}>
              <C>{t.name}</C>
              {i < all.length - 2 ? ", " : i === all.length - 2 ? " and " : ""}
            </span>
          ))}{" "}
          send real email. Their descriptions tell your agent to call them only after you&apos;ve seen the preview or the draft and said
          yes.
        </p>
        <p>
          Every tool also carries a title and the standard MCP hints: read-only, destructive (it sends, deletes or overwrites), and open-world
          (it reaches outside your account: the lead database, DNS or someone&apos;s inbox). Claude, ChatGPT and other clients use them to ask
          you before running a destructive tool.
        </p>
      </Callout>

      <nav aria-label="Tool groups" className="flex flex-wrap gap-2">
        {toolGroups.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg hover:border-accent/35 hover:text-accent">
            {g.label} <span className="font-mono text-[12px] font-normal text-muted">{g.tools.length}</span>
          </a>
        ))}
        <a href="#commands" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg hover:border-accent/35 hover:text-accent">
          Commands <span className="font-mono text-[12px] font-normal text-muted">{mcp.prompts.length}</span>
        </a>
      </nav>

      {toolGroups.map((g) => (
        <section key={g.id} className="flex flex-col gap-3">
          <H2 id={g.id}>
            {g.label} <span className="font-mono text-[13px] font-normal text-muted">{g.tools.length}</span>
          </H2>
          <p className="text-[15px]">
            How it works: <L href={docHref(g.page)}>{g.label}</L>.
          </p>
          <div className="overflow-hidden rounded-xl border border-line">
            {g.tools.map((name) => (
              <ToolEntry key={name} tool={toolByName(name)} />
            ))}
          </div>
        </section>
      ))}

      <H2 id="commands">Commands</H2>
      <p>
        Ready-made prompts that chain the tools. In Claude Code they show up as slash commands; other clients list them as prompts.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {mcp.prompts.map((p) => (
          <div key={p.name} className="flex flex-col gap-2 rounded-xl border border-line bg-raised px-[18px] py-4">
            <p className="font-mono text-[13px] text-accent">/mcp__meerko__{p.name}</p>
            <p className="font-semibold text-fg">{p.title}</p>
            <p className="text-[15px] leading-[1.55]">{p.description}</p>
            {p.arguments.length > 0 && (
              <p className="font-mono text-xs">
                {p.arguments.map((a) => `${a.name}${a.required ? "" : "?"}`).join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </DocsShell>
  );
}
