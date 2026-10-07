import path from "node:path";
import type { NextConfig } from "next";
import { withPostHogConfig } from "@posthog/nextjs-config";

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
  // PostHog through our own origin, so ad blockers don't drop analytics (no custom domain for a managed proxy yet).
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  // PostHog's API paths end in a slash; a redirect would break them.
  skipTrailingSlashRedirect: true,
  // Only when maps are uploaded (below); otherwise Next would serve them publicly.
  productionBrowserSourceMaps: Boolean(process.env.POSTHOG_CLI_API_KEY),
};

// Uploads browser source maps to PostHog Error Tracking, then deletes them, during `next build`. Gated on the
// personal key (a BuildKit secret on prd, see terraform/app/build.tf), so any other build is a normal one.
const withSourceMaps = (config: NextConfig) =>
  process.env.POSTHOG_CLI_API_KEY
    ? withPostHogConfig(config, {
        personalApiKey: process.env.POSTHOG_CLI_API_KEY,
        projectId: process.env.POSTHOG_CLI_PROJECT_ID,
        host: process.env.POSTHOG_CLI_HOST || "https://eu.posthog.com",
        sourcemaps: {
          enabled: true,
          releaseName: "meerko-web",
          // There's no .git in the Docker build context, so Cloud Build passes the commit.
          releaseVersion: process.env.NEXT_PUBLIC_COMMIT_SHA,
          deleteAfterUpload: true,
        },
      })
    : config;

export default withSourceMaps(nextConfig);
