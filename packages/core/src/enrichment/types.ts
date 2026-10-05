export type EnrichField = "email" | "email_verification";

/** Provider-reported confidence, e.g. Icypeas `ultra_sure` | `very_sure` | `probable` | `undeliverable`. */
export type Confidence = string;

export interface EnrichResult {
  /** `null` when the provider ran but found nothing. */
  value: unknown;
  confidence?: Confidence;
  /** Provider credits actually consumed (0 on a miss for Icypeas). */
  providerCost: number;
  raw?: unknown;
}

export interface EnrichmentProvider {
  name: string;
  supports: readonly EnrichField[];
  enrich(field: EnrichField, row: Record<string, unknown>): Promise<EnrichResult>;
}

/** Raised for inputs a provider can't use (e.g. no name or domain); the waterfall skips to the next provider. */
export class MissingInputError extends Error {}
