import { ChevronDown } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { OpenOnHash } from "@/components/lookout/docs/search";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, L } from "@/components/lookout/docs/ui";
import { type ApiOperation, type Field, apiGroups, apiObjects, apiOperations } from "@/lib/api-reference";
import { publicApiUrl } from "@/lib/meerko";

export const metadata = docsMetadata("api", "Meerko REST API reference | Meerko docs");

const METHOD_COLOR: Record<string, string> = {
  GET: "text-accent",
  POST: "text-fg",
  PUT: "text-fg",
  PATCH: "text-fg",
  DELETE: "text-red-500",
};

function FieldTable({ title, fields }: { title: string; fields: Field[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[12px] tracking-[0.14em] uppercase">{title}</p>
      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full text-left text-[13.5px]">
          <tbody>
            {fields.map((f) => (
              <tr key={f.name} className="border-t border-line align-top first:border-t-0">
                <td className="px-3.5 py-2.5 font-mono whitespace-nowrap text-fg">{f.name}</td>
                <td className="px-3.5 py-2.5 font-mono text-xs">{f.type}</td>
                <td className="px-3.5 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[12px] ${f.required ? "bg-accent-soft text-accent" : "bg-ink"}`}>
                    {f.required ? "required" : "optional"}
                  </span>
                </td>
                <td className="min-w-[220px] px-3.5 py-2.5 leading-[1.45]">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationEntry({ op }: { op: ApiOperation }) {
  return (
    <details id={op.id} className="group scroll-mt-24 border-t border-line first:border-t-0 open:bg-raised">
      <summary className="flex cursor-pointer list-none items-start gap-4 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
        <span className={`w-[58px] shrink-0 pt-px font-mono text-[12px] font-semibold ${METHOD_COLOR[op.method] ?? ""}`}>{op.method}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[13.5px] break-all text-fg">{op.path}</span>
          <span className="block text-[15px] leading-normal">{op.summary}</span>
        </span>
        <ChevronDown className="mt-1 size-3.5 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 px-[18px] pb-5">
        {op.description && <p className="text-[15px] leading-[1.55]">{op.description}</p>}
        {op.repliesScope && (
          <p className="text-[15px]">
            Also callable with a <C>replies</C> key, the kind an agent woken by an <L href="/docs/wake-your-agent">agent hook</L> gets.
          </p>
        )}
        <FieldTable title="Parameters" fields={op.params} />
        <FieldTable title="Body (JSON)" fields={op.body} />
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[12px] tracking-[0.14em] uppercase">Returns {op.status}</p>
          <p className="font-mono text-[13px] break-words">{op.returns}</p>
        </div>
      </div>
    </details>
  );
}

export default function Page() {
  const base = publicApiUrl();
  return (
    <DocsShell
      slug="api"
      lead={
        <p>
          Everything the dashboard, the CLI and the MCP server do, over HTTP: {apiOperations.length} endpoints. They are all clients of this
          same API, so anything your agent can do, a script can too. This page is generated from the API&apos;s own route definitions.
        </p>
      }
      toc={[["auth", "Authentication"], ...apiGroups.map((g) => [g.id, g.label] as [string, string]), ["objects", "Objects"]]}
    >
      <OpenOnHash />
      <H2 id="auth">Authentication</H2>
      <p>
        Send an <L href="/docs/api-keys">API key</L> as a bearer token. Every request acts on the key&apos;s workspace. Bodies and
        responses are JSON; errors come back as <C>{"{ error: string }"}</C> with a 4xx or 5xx status.
      </p>
      <CodeBlock
        title="bash"
        code={`curl -H "Authorization: Bearer mk_…" ${base}/v1/tables`}
        lines={[{ text: `$ curl -H "Authorization: Bearer mk_…" ${base}/v1/tables` }]}
      />
      <Callout>
        <p>
          The OpenAPI 3.1 document is at <L href="/openapi.json">/openapi.json</L>, for generating a client or importing into Postman.
          Managing API keys, apps, Slack, the agent hook and billing needs you signed in to the dashboard, so those endpoints aren&apos;t
          listed here.
        </p>
      </Callout>

      <nav aria-label="Endpoint groups" className="flex flex-wrap gap-2">
        {apiGroups.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-fg hover:border-accent/35 hover:text-accent">
            {g.label} <span className="font-mono text-[12px] font-normal text-muted">{g.ops.length}</span>
          </a>
        ))}
      </nav>

      {apiGroups.map((g) => (
        <section key={g.id} className="flex flex-col gap-3">
          <H2 id={g.id}>
            {g.label} <span className="font-mono text-[13px] font-normal text-muted">{g.ops.length}</span>
          </H2>
          <p className="text-[15px]">{g.description}.</p>
          <div className="overflow-hidden rounded-xl border border-line">
            {g.ops.map((op) => (
              <OperationEntry key={op.id} op={op} />
            ))}
          </div>
        </section>
      ))}

      <H2 id="objects">Objects</H2>
      <p>The shapes the endpoints return. Fields may be added; clients should ignore ones they don&apos;t know.</p>
      <div className="overflow-hidden rounded-xl border border-line">
        {apiObjects.map((o) => (
          <details key={o.name} id={`object-${o.name}`} className="group scroll-mt-24 border-t border-line first:border-t-0 open:bg-raised">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-[18px] py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex-1 font-mono text-[13.5px] text-accent">{o.name}</span>
              <ChevronDown className="size-3.5 shrink-0 transition group-open:rotate-180" />
            </summary>
            <div className="px-[18px] pb-5">
              <FieldTable title="Fields" fields={o.fields} />
            </div>
          </details>
        ))}
      </div>
    </DocsShell>
  );
}
