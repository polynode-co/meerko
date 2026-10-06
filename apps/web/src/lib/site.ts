// Single place for URLs so nothing domain-specific is hard-coded in components.
export const site = {
  // `||` not `??`: an unset Docker build arg arrives as an empty string.
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  githubUrl: "https://github.com/iker-gonzalez/meerko",
  docsUrl: "/docs",
  pricingUrl: "/pricing",
  // Cloud plans start by signing in (Google); the first sign-in creates the workspace.
  signupUrl: "/login",
  installCommand: "npx meerko init",
};
