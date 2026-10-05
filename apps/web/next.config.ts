import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal self-contained server for the Cloud Run container (see apps/web/Dockerfile).
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
