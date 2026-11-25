// Countries in lead searches and the ICP: a person writes "Spain", "España", "ES" or "spain" and means the same
// country. Names come from Intl (no country list to maintain), in the languages location strings use.

const LANGS = ["en", "es", "fr", "de", "pt", "it", "nl"] as const;

/** More names location strings use: ones Intl has renamed, and England, so GB also matches "London, England". */
const EXTRA_NAMES: Record<string, string[]> = {
  US: ["United States"],
  GB: ["United Kingdom", "England"],
  TR: ["Turkey"],
  CZ: ["Czech Republic"],
};
/** Names of part of a country: searched for it, but typed on their own they mean the part ("England", not all of GB). */
const PART_OF = new Set(["England"]);

/** What people write for a country that isn't its code or one of Intl's names for it. */
const ALIASES: Record<string, string> = {
  uk: "GB",
  "u.k.": "GB",
  britain: "GB",
  "great britain": "GB",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  america: "US",
  "united states of america": "US",
  uae: "AE",
  holland: "NL",
  "ivory coast": "CI",
};

/** Regions Intl names that aren't countries a lead lives in. */
const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();

/** Country names a location string may use for an alpha-2 code: English, Spanish, French, German, Portuguese, Italian, Dutch. */
export const countryNames = (() => {
  const cache = new Map<string, string[]>();
  return (code: string) => {
    const c = code.toUpperCase();
    if (!cache.has(c)) {
      const names = new Set<string>(EXTRA_NAMES[c] ?? []);
      if (/^[A-Z]{2}$/.test(c) && !NOT_COUNTRIES.has(c)) {
        for (const lang of LANGS) {
          try {
            const n = new Intl.DisplayNames([lang], { type: "region" }).of(c);
            if (n && n !== c) names.add(n);
          } catch {
            // Unknown code: no names.
          }
        }
      }
      cache.set(c, [...names]);
    }
    return cache.get(c)!;
  };
})();

/** Every current alpha-2 code Intl names, with its names normalised: built once, on first use. */
const byName = (() => {
  let map: Map<string, string> | null = null;
  return () => {
    if (map) return map;
    map = new Map(Object.entries(ALIASES));
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        if (NOT_COUNTRIES.has(code)) continue;
        // Retired codes ("UK" for GB, "BU" for MM) canonicalise to another code; they're read as that one.
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue;
        for (const name of countryNames(code)) if (!PART_OF.has(name) && !map.has(norm(name))) map.set(norm(name), code);
      }
    return map;
  };
})();

/** The alpha-2 code a location value names: "Spain", "españa", "ES", "uk" and "USA" all resolve. Null when it isn't a country. */
export function countryCode(value: string): string | null {
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) {
    const canon = Intl.getCanonicalLocales(`und-${v.toUpperCase()}`)[0]!.slice(4);
    return countryNames(canon).length ? canon : null;
  }
  return byName().get(norm(v)) ?? null;
}

/** Edits between two strings, a swap of neighbours counting as one ("Spian" is 1 from "Spain"). */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
}

/**
 * The country a value that isn't one was probably meant to be: one typo away ("Spian", "Germnay"), two for long names.
 * Strict on purpose, so a city ("Berlin") isn't taken for a country ("Benin").
 */
export function closestCountry(value: string): string | null {
  const v = norm(value);
  if (v.length < 4) return null;
  const max = v.length >= 8 ? 2 : 1;
  let best: { code: string; d: number } | null = null;
  for (const [name, code] of byName()) {
    if (Math.abs(name.length - v.length) > max) continue;
    const d = distance(v, name);
    if (d <= max && (!best || d < best.d)) best = { code, d };
  }
  return best?.code ?? null;
}

/** How one location value of a search was read: the country it names, or none and the one it may be a typo of. */
export interface LocationCheck {
  value: string;
  /** Alpha-2 code; null when the value isn't a country, so it's matched as text (a city or region). */
  country: string | null;
  /** When `country` is null: the country the value is a likely typo of. */
  suggestion?: string;
}

export function checkLocation(value: string): LocationCheck {
  const country = countryCode(value);
  if (country) return { value, country };
  const suggestion = closestCountry(value);
  return { value, country: null, ...(suggestion ? { suggestion } : {}) };
}
