import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoClient } from "@meerko/sdk";
import { LoginForm } from "@/components/app/login-form";
import { API_KEY_COOKIE, apiUrl } from "@/lib/meerko";

/** Whether the saved key still works; a revoked key or an unreachable API shows the form. */
async function hasValidKey(key: string) {
  try {
    await new MeerkoClient({ apiUrl: apiUrl(), apiKey: key }).listTables();
    return true;
  } catch {
    return false;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const expired = !!(await searchParams).expired;
  // Already signed in: skip the form. (`expired` means the dashboard just rejected the key.)
  const key = (await cookies()).get(API_KEY_COOKIE)?.value;
  if (key && !expired && (await hasValidKey(key))) redirect("/app");
  return <LoginForm expired={expired} />;
}
