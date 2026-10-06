"use server";

import { redirect } from "next/navigation";
import { MeerkoApiError } from "@meerko/sdk";
import { meerko } from "@/lib/meerko";

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
