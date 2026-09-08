/** Canonical product name — use everywhere in UI copy. */
export const BRAND_NAME = "GotREFS";

const BRAND_VARIANT_PATTERN =
  /\b(?:GOTREFS|GotREFS|GotRefs|Gotrefs|GoTRefs|GotREF'?s|GotRef'?s)\b/g;

/** Normalize user-facing copy to the canonical GotREFS brand spelling. */
export function normalizeBrandInText(text: string) {
  return text.replace(BRAND_VARIANT_PATTERN, BRAND_NAME);
}
