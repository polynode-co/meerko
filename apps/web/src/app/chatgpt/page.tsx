import type { Metadata } from "next";
import { AssistantLanding } from "@/components/assistant/assistant-landing";
import { assistantPages } from "@/lib/assistant-pages";

// "ChatGPT for sales" and "can ChatGPT send emails". Its target queries are in lib/assistant-pages.ts.
const p = assistantPages.chatgpt;

export const metadata: Metadata = {
  title: p.title,
  description: p.description,
  alternates: { canonical: "/chatgpt" },
};

export default function Page() {
  return <AssistantLanding slug="chatgpt" />;
}
