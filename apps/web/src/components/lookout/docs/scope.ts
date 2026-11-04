import type { CSSProperties } from "react";

// Docs and guide pages carry their own inline classes from the previous design (text-fg, text-accent, bg-raised,
// border-line, font-mono, font-display, rounded-*). Inside this scope those tokens resolve to the Lookout palette and
// fonts, so every page's body restyles with its shell instead of being rewritten one by one.

/** Remaps the old theme variables to Lookout ones for everything inside. */
export const lkScopeStyle = {
  "--color-fg": "var(--color-lk-fg)",
  "--color-muted": "var(--color-lk-muted)",
  "--color-accent": "var(--color-lk-lime)",
  "--color-accent-soft": "rgb(168 243 38 / 0.07)",
  "--color-line": "var(--color-lk-line)",
  "--color-raised": "var(--color-lk-box)",
  "--color-ink": "var(--color-lk-ink)",
  "--color-dark": "var(--color-lk-bg)",
  "--color-signal": "var(--color-lk-lime)",
  "--font-jetbrains": "var(--font-plex-mono)",
  "--font-bricolage": "var(--font-inter)",
} as CSSProperties;

/** Lookout is square: no rounded corners inside the scope. */
export const lkScopeClass = "[&_*]:rounded-none";
