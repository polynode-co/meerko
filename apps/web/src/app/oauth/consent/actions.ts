"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { apiUrl, meerko, SESSION_COOKIE } from "@/lib/meerko";

/** Allow or Cancel on the consent page: the API returns where to send the browser (back to the app). */
export async function decide(form: FormData) {
  const request = String(form.get("request") ?? "");
  const approve = form.get("decision") === "allow";
  let to: string;
  try {
    ({ redirect_to: to } = await (await meerko()).decideOAuthRequest(request, approve));
  } catch (err) {
    if (!(err instanceof MeerkoApiError)) throw err;
    redirect(`/oauth/consent?request=${encodeURIComponent(request)}&error=${encodeURIComponent(err.message)}`);
  }
  redirect(to);
}

/** "Not you?": ends this dashboard session and signs in again, coming back to the same request. */
export async function switchAccount(form: FormData) {
  const request = String(form.get("request") ?? "");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token?.startsWith("ms_")) await new MeerkoClient({ apiUrl: apiUrl(), apiKey: token }).logout().catch(() => {});
  store.delete(SESSION_COOKIE);
  redirect(`/login?next=${encodeURIComponent(`/oauth/consent?request=${encodeURIComponent(request)}`)}`);
}
