export type EnrichField = "email" | "email_verification" | "phone";

/** Provider-reported confidence, e.g. Icypeas `ultra_sure` | `very_sure` | `probable` | `undeliverable`. */
export type Confidence = string;

export interface EnrichResult {
  /** `null` when the provider ran but found nothing. */
  value: unknown;
  confidence?: Confidence;
  /** What the provider charged, in its own unit: Icypeas and Firecrawl credits, Generect USD. 0 on a miss. */
  providerCost: number;
  raw?: unknown;
}

export interface EnrichmentProvider {
  name: string;
  supports: readonly EnrichField[];
  /** Runs on the workspace's own key, so what it finds costs no Meerko credits. */
  ownKey?: boolean;
  enrich(field: EnrichField, row: Record<string, unknown>): Promise<EnrichResult>;
}

/** Raised for inputs a provider can't use (e.g. no name or domain); the waterfall skips to the next provider. */
export class MissingInputError extends Error {}
