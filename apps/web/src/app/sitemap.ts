import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Public, indexable pages only (the dashboard and sign-in are excluded in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
    { path: "/clay-alternative", changeFrequency: "monthly", priority: 0.7 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, site.url).toString(),
    changeFrequency: changeFrequency as MetadataRoute.Sitemap[number]["changeFrequency"],
    priority,
  }));
}
