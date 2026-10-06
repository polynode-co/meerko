import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  // Targets "ai sales agent" (1.3k/mo US, KD 15, +140% YoY) and "ai sdr" (DataForSEO, Oct 2026).
  title: "Meerko — the open-source AI sales agent",
  description:
    "Meerko is an open-source AI sales agent (AI SDR): find leads, send cold email from your own Gmail and catch every reply, from Claude Code or Cursor.",
  icons: { icon: "/meerko-mark.svg" },
  openGraph: {
    title: "Meerko — the open-source AI sales agent",
    description: "An AI SDR you run from Claude Code: find leads, send from your own Gmail, catch every reply. Open source.",
    images: ["/meerko-mascot.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body id="top">{children}</body>
    </html>
  );
}
