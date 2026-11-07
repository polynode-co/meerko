import { siteHost } from "@/lib/site-hint";

// A site's favicon for the sign-in and welcome pages, fetched on our side so the visitor's browser doesn't call a
// third party: DuckDuckGo's icon service first, then Google's for newer sites DuckDuckGo hasn't indexed. It only
// takes a bare domain name (never a URL), so it can't be pointed at anything else.
const SOURCES = [(host: string) => `https://icons.duckduckgo.com/ip3/${host}.ico`, (host: string) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`];

export async function GET(request: Request) {
  const host = siteHost(new URL(request.url).searchParams.get("domain"));
  if (!host) return new Response(null, { status: 400 });
  for (const source of SOURCES) {
    try {
      const res = await fetch(source(host), { signal: AbortSignal.timeout(4000) });
      const type = res.headers.get("content-type") ?? "";
      // Both answer 404 with a generic placeholder for unknown sites; the pages show the site's initial instead.
      if (!res.ok || !type.startsWith("image/")) continue;
      const body = await res.arrayBuffer();
      if (body.byteLength > 200_000) continue;
      return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
    } catch {
      // Try the next source.
    }
  }
  return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
}
