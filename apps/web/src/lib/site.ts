// Single place for URLs so nothing domain-specific is hard-coded in components.
export const site = {
  // `||` not `??`: an unset Docker build arg arrives as an empty string.
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  githubUrl: "https://github.com/polynode-co/meerko",
  docsUrl: "/docs",
  pricingUrl: "/pricing",
  // Cloud plans start by signing in (Google); the first sign-in creates the workspace.
  signupUrl: "/login",
  // Shared inbox for sales, support, privacy and legal questions. A polynode.co Workspace group
  // (core-infrastructure environments/com/workspace) that answers on meerko.ai as an alias domain.
  contactEmail: "contact@meerko.ai",
  // Self-hosting starts from the repo (not on npm yet).
  installCommand: "git clone https://github.com/polynode-co/meerko",
  // The landing page's product video (a file under /public or a full URL): the narrated cut in /public/video,
  // unless NEXT_PUBLIC_DEMO_VIDEO_URL names another one.
  demoVideoUrl: process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || "/video/meerko-30s.mp4",
  // The frame the player shows before play.
  demoVideoPosterUrl: "/video/meerko-30s-poster.jpg",
  // English captions (WebVTT). They are timed to the narrated cut, so another video goes without them.
  demoVideoCaptionsUrl: process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ? "" : "/video/meerko-30s.en.vtt",
  // Its length. The "Watch · 30 seconds" cues and the player's 0:30 badge are both written from this number.
  demoVideoSeconds: 30,
};
