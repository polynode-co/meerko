import type { Metadata } from "next";
import { AssistantLanding } from "@/components/assistant/assistant-landing";
import { assistantPages } from "@/lib/assistant-pages";

// "Mistral MCP" and Mistral Vibe's connectors (formerly Le Chat). Its target queries are in lib/assistant-pages.ts.
const p = assistantPages.mistral;

export const metadata: Metadata = {
  title: p.title,
  description: p.description,
  alternates: { canonical: "/mistral" },
};

export default function Page() {
  return <AssistantLanding slug="mistral" />;
}
