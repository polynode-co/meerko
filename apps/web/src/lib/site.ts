// Single place for URLs so nothing domain-specific is hard-coded in components.
export const site = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  githubUrl: "https://github.com/iker-gonzalez/meerko",
  docsUrl: "https://github.com/iker-gonzalez/meerko#readme",
  signupUrl: "#pricing",
  installCommand: "npx meerko init",
};
