import type { Instrumentation } from "next";

// Server errors (route handlers, server components, server actions) to PostHog Error Tracking.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { posthogServer } = await import("./lib/posthog-server");
  const posthog = posthogServer();
  if (!posthog) return;
  try {
    await posthog.captureExceptionImmediate(err, "service:web:" + (process.env.NEXT_PUBLIC_APP_ENV || "local"), {
      surface: "web",
      app_env: process.env.NEXT_PUBLIC_APP_ENV || "local",
      $release: process.env.NEXT_PUBLIC_COMMIT_SHA,
      path: request.path,
      method: request.method,
      route_path: context.routePath,
      route_type: context.routeType,
      digest: typeof err === "object" && err && "digest" in err ? String(err.digest) : undefined,
    });
  } catch (e) {
    console.error("PostHog error capture failed:", e);
  }
};
