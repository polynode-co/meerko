import type { MetadataRoute } from "next";
import { alternatives, guides } from "@/lib/content";
import { site } from "@/lib/site";

// Public, indexable pages only (the dashboard and sign-in are excluded in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
    { path: "/guides", changeFrequency: "weekly", priority: 0.7 },
    { path: "/alternatives", changeFrequency: "monthly", priority: 0.7 },
    ...guides.map((g) => ({ path: `/guides/${g.slug}`, changeFrequency: "monthly", priority: 0.7 })),
    ...alternatives.map((a) => ({ path: `/alternatives/${a.slug}`, changeFrequency: "monthly", priority: 0.7 })),
  ].map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, site.url).toString(),
    changeFrequency: changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority,
  }));
}
