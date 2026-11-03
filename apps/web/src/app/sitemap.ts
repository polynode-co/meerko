import type { MetadataRoute } from "next";
import { alternatives, guides } from "@/lib/content";
import { docHref, docPages } from "@/lib/docs";
import { integrationPages } from "@/lib/integrations";
import { site } from "@/lib/site";

// Public, indexable pages only (the dashboard and sign-in are excluded in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    ...docPages.map((p) => ({ path: docHref(p.slug), changeFrequency: "weekly", priority: p.slug ? 0.6 : 0.8 })),
    { path: "/guides", changeFrequency: "weekly", priority: 0.7 },
    { path: "/alternatives", changeFrequency: "monthly", priority: 0.7 },
    { path: "/integrations", changeFrequency: "monthly", priority: 0.7 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    ...guides.map((g) => ({ path: `/guides/${g.slug}`, changeFrequency: "monthly", priority: 0.7 })),
    ...alternatives.map((a) => ({ path: `/alternatives/${a.slug}`, changeFrequency: "monthly", priority: 0.7 })),
    ...integrationPages.map((i) => ({ path: `/integrations/${i.slug}`, changeFrequency: "monthly", priority: 0.7 })),
  ].map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, site.url).toString(),
    changeFrequency: changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority,
  }));
}
