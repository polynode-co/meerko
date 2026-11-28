import type { Metadata } from "next";
import { AssistantLanding } from "@/components/assistant/assistant-landing";
import { assistantPages } from "@/lib/assistant-pages";

// "Perplexity MCP" and the Perplexity plugin. Its target queries are in lib/assistant-pages.ts.
const p = assistantPages.perplexity;

export const metadata: Metadata = {
  title: p.title,
  description: p.description,
  alternates: { canonical: "/perplexity" },
};

export default function Page() {
  return <AssistantLanding slug="perplexity" />;
}
