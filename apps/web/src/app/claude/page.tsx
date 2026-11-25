import type { Metadata } from "next";
import { AssistantLanding } from "@/components/assistant/assistant-landing";
import { assistantPages } from "@/lib/assistant-pages";

// "Claude for sales". Its target queries are in lib/assistant-pages.ts.
const p = assistantPages.claude;

export const metadata: Metadata = {
  title: p.title,
  description: p.description,
  alternates: { canonical: "/claude" },
};

export default function Page() {
  return <AssistantLanding slug="claude" />;
}
