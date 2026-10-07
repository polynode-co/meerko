import posthog from "posthog-js";

// PostHog in the browser (same setup as antwork): pageviews, replay with inputs masked, uncaught errors.
// Off without NEXT_PUBLIC_POSTHOG_KEY, so local runs and self-hosted installs send nothing.
// The dashboard's text (leads, replies, drafts) is masked in replays with data-ph-mask (app/app/layout.tsx).
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || "local";
const release = process.env.NEXT_PUBLIC_COMMIT_SHA;

/** Which part of the site an event came from; the marketing site and the dashboard share one origin. */
const surfaceFor = (pathname: string) => (pathname === "/app" || pathname.startsWith("/app/") || pathname.startsWith("/oauth/") ? "app" : "marketing");

if (key) {
  try {
    posthog.init(key, {
      // Through the /ingest rewrite in next.config.ts; ui_host keeps toolbar and replay links on PostHog.
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      // App Router navigations are history changes, so this records every route without a manual hook.
      capture_pageview: "history_change",
      capture_pageleave: true,
      // A person for every visitor, so first-touch referrer and UTM survive to sign-up.
      person_profiles: "always",
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-ph-mask]",
      },
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      capture_performance: { network_timing: true, web_vitals: false },
      // Stamped here rather than with register(), which reset() clears on sign-out.
      before_send: (event) => {
        if (!event) return null;
        event.properties = {
          ...event.properties,
          app_env: appEnv,
          surface: surfaceFor(window.location.pathname),
          ...(release ? { $release: release } : {}),
        };
        return event;
      },
    });
  } catch (err) {
    console.error("PostHog failed to start:", err);
  }
}
