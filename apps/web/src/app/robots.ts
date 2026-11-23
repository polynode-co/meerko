import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/login", "/auth", "/r/"] },
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
