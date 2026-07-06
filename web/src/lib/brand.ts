/** Canonical product name — use everywhere in UI copy. */
export const BRAND_NAME = "GotREFS";

const BRAND_VARIANT_PATTERN = /\b(?:GOTREFS|GotRefs|Gotrefs|GoTRefs|gotrefs)\b/g;

/** Normalize user-facing copy to the canonical GotREFS brand spelling. */
export function normalizeBrandInText(text: string) {
  return text.replace(BRAND_VARIANT_PATTERN, BRAND_NAME);
}
