import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";

export const API_KEY_COOKIE = "meerko_key";
export const apiUrl = () => process.env.MEERKO_API_URL ?? "http://localhost:8787";

/** API client for the signed-in workspace. Sends anyone without a valid key to /login. */
export async function meerko() {
  const key = (await cookies()).get(API_KEY_COOKIE)?.value;
  if (!key) redirect("/login");
  return new MeerkoClient({ apiUrl: apiUrl(), apiKey: key });
}

/** Runs an API read; an expired or revoked key goes back to /login instead of crashing the page. */
export async function load<T>(fn: (client: MeerkoClient) => Promise<T>): Promise<T> {
  const client = await meerko();
  try {
    return await fn(client);
  } catch (err) {
    if (err instanceof MeerkoApiError && err.status === 401) redirect("/login?expired=1");
    throw err;
  }
}
