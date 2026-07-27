/** Canonical product name — use everywhere in UI copy. */
export const BRAND_NAME = "GotRefs";

const BRAND_VARIANT_PATTERN =
  /\b(?:GOTREFS|GotREFS|Gotrefs|GoTRefs|GotREF'?s|GotRef'?s)\b/g;

/** Normalize user-facing copy to the canonical GotRefs brand spelling. */
export function normalizeBrandInText(text: string) {
  return text.replace(BRAND_VARIANT_PATTERN, BRAND_NAME);
}
