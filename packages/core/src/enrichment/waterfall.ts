import { MissingInputError, type EnrichField, type EnrichmentProvider } from "./types.ts";

export interface WaterfallAttempt {
  provider: string;
  outcome: "found" | "not_found" | "skipped" | "error";
  providerCost: number;
  error?: string;
}

export interface WaterfallResult {
  value: unknown;
  confidence?: string;
  /** Provider that produced `value`; null when every provider missed. */
  provider: string | null;
  attempts: WaterfallAttempt[];
  /** Sum of provider credits across all attempts, for margin tracking. */
  providerCost: number;
}

/**
 * Tries providers in order and stops at the first that returns a value.
 * A provider error or missing input moves on to the next provider rather than failing the row.
 */
export async function runWaterfall(
  providers: EnrichmentProvider[],
  field: EnrichField,
  row: Record<string, unknown>,
): Promise<WaterfallResult> {
  const attempts: WaterfallAttempt[] = [];
  for (const provider of providers.filter((p) => p.supports.includes(field))) {
    try {
      const result = await provider.enrich(field, row);
      const found = result.value !== null && result.value !== undefined;
      attempts.push({ provider: provider.name, outcome: found ? "found" : "not_found", providerCost: result.providerCost });
      if (found) {
        return { value: result.value, confidence: result.confidence, provider: provider.name, attempts, providerCost: sumCost(attempts) };
      }
    } catch (err) {
      attempts.push({
        provider: provider.name,
        outcome: err instanceof MissingInputError ? "skipped" : "error",
        providerCost: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { value: null, provider: null, attempts, providerCost: sumCost(attempts) };
}

const sumCost = (attempts: WaterfallAttempt[]) => attempts.reduce((n, a) => n + a.providerCost, 0);
