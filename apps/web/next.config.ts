import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal self-contained server for the Cloud Run container (see apps/web/Dockerfile).
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Pages moved into the /guides and /alternatives hubs (docs/CONTENT.md).
  async redirects() {
    return [
      { source: "/gtm-engineer", destination: "/guides/gtm-engineer", permanent: true },
      { source: "/clay-alternative", destination: "/alternatives/clay", permanent: true },
    ];
  },
};

export default nextConfig;
