"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

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
    if (!posthog.__loaded) return;
    // API-key logins (self-hosting) have no person; the workspace stands in, like on the API.
    posthog.identify(user?.id ?? workspace.id, user ? { email: user.email, name: user.name } : { workspace_name: workspace.name });
    posthog.group("workspace", workspace.id, { name: workspace.name });
  }, [user?.id, user?.email, user?.name, workspace.id, workspace.name]);

  return null;
}
