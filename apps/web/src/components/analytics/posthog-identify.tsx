"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { COOKIE_CHOSEN } from "@/components/analytics/cookie-banner";
import { hasInternalDomain } from "@/lib/internal-domain";
import { markInternalVisitor } from "@/lib/internal-visitor";
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
    // Our own address: this browser is ours from now on, signed in or not, cookie or not (lib/internal-visitor.ts).
    if (hasInternalDomain(user?.email)) markInternalVisitor();

    // API-key logins (self-hosting) have no person; the workspace stands in, like on the API.
    const id = user?.id ?? workspace.id;
    const apply = () => {
      if (!posthog.__loaded) return;
      if (posthog.get_explicit_consent_status() !== "granted") {
        // No cookie, so no browser identity to tie to a person. `app_user_id` rides on this session's events
        // instead, held in memory (cookieless mode persists nothing), so its clicks can still be found by user.
        posthog.register({ app_user_id: id });
        return;
      }
      posthog.unregister("app_user_id");
      posthog.identify(id, user ? { email: user.email, name: user.name } : { workspace_name: workspace.name });
      posthog.group("workspace", workspace.id, { name: workspace.name });
    };

    // PostHog starts once the visitor's region is known (instrumentation-client.ts). A cookie answer given after
    // that (the banner, or the automatic opt-in where no consent is needed) applies identity again.
    void visitorRegion().then(apply);
    window.addEventListener(COOKIE_CHOSEN, apply);
    return () => window.removeEventListener(COOKIE_CHOSEN, apply);
  }, [user?.id, user?.email, user?.name, workspace.id, workspace.name]);

  return null;
}
