import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Meerko — the open-source GTM agent",
  description:
    "Meerko finds your leads, enriches them, sends from your own inbox and catches every reply — driven from your terminal or Claude Code. The open-source toolkit for GTM engineers.",
  keywords: ["gtm engineer", "open source clay alternative", "instantly alternative", "ai sdr", "cold email", "outbound automation"],
  icons: { icon: "/meerko-mark.svg" },
  openGraph: {
    title: "Meerko — the open-source GTM agent",
    description: "Leads in. Meetings out. Open source, agent-native outbound.",
    images: ["/meerko-mascot.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
