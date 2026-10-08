// Single place for URLs so nothing domain-specific is hard-coded in components.
export const site = {
  // `||` not `??`: an unset Docker build arg arrives as an empty string.
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  githubUrl: "https://github.com/iker-gonzalez/meerko.ai",
  docsUrl: "/docs",
  pricingUrl: "/pricing",
  // Cloud plans start by signing in (Google); the first sign-in creates the workspace.
  signupUrl: "/login",
  // Shared inbox for sales, support, privacy and legal questions. A polynode.co Workspace group
  // (core-infrastructure environments/com/workspace) that answers on meerko.ai as an alias domain.
  contactEmail: "contact@meerko.ai",
  // Self-hosting starts from the repo (not on npm yet).
  installCommand: "git clone https://github.com/iker-gonzalez/meerko.ai",
};
