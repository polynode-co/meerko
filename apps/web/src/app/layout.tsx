import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inter, JetBrains_Mono, Silkscreen } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
// The landing page's type: IBM Plex Mono for labels and terminals, Silkscreen for the pixel "OS" chrome.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "600"] });
const silkscreen = Silkscreen({ subsets: ["latin"], variable: "--font-silkscreen", weight: ["400"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  // Targets "ai sales agent" (1.3k/mo US, KD 15, +140% YoY) and "ai sdr" (DataForSEO, Oct 2026).
  title: "Meerko — the open-source AI sales agent",
  description:
    "Meerko is an open-source AI sales agent (AI SDR): find leads, send cold email from your own Gmail or Outlook and catch every reply, from Claude Code or Cursor.",
  icons: { icon: "/meerko-icon.svg" },
  openGraph: {
    title: "Meerko — the open-source AI sales agent",
    description: "An AI SDR you run from Claude Code: find leads, send from your own Gmail or Outlook, catch every reply. Open source.",
    images: ["/meerko-mascot.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable} ${plexMono.variable} ${silkscreen.variable}`}>
      <body id="top">{children}</body>
    </html>
  );
}
