"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { visitorRegion } from "@/lib/visitor-region";

/**
 * Ties this browser's events to the signed-in person and their workspace. Mounted by the dashboard layout;
 * sign-out calls posthog.reset() (sidebar), so the next person on this browser starts anonymous.
 */
export function PostHogIdentify({
  user,
  workspace,
}: {
  user: { id: string; email: string; name: string | null } | null;
  workspace: { id: string; name: string };
}) {
  useEffect(() => {
    // PostHog starts once the visitor's region is known (instrumentation-client.ts).
    void visitorRegion().then(() => {
      // Only with the cookie accepted: a cookieless visitor has no browser identity to tie to a person.
      if (!posthog.__loaded || posthog.get_explicit_consent_status() !== "granted") return;
      // API-key logins (self-hosting) have no person; the workspace stands in, like on the API.
      posthog.identify(user?.id ?? workspace.id, user ? { email: user.email, name: user.name } : { workspace_name: workspace.name });
      posthog.group("workspace", workspace.id, { name: workspace.name });
    });
  }, [user?.id, user?.email, user?.name, workspace.id, workspace.name]);

  return null;
}
