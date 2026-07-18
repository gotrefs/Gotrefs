/** Sports available for refs/organizers — names only, A–Z. */
export const PRIMARY_SPORTS = [
  "American Football",
  "Archery",
  "Australian Rules Football",
  "Badminton",
  "Bandy",
  "Baseball",
  "Basketball",
  "Boxing",
  "Cricket",
  "Curling",
  "Diving",
  "Equestrian",
  "Fencing",
  "Field Hockey",
  "Figure Skating",
  "Gaelic Football / Hurling",
  "Golf",
  "Gymnastics",
  "Handball (Team)",
  "Ice Hockey",
  "Judo",
  "Lacrosse",
  "Mixed Martial Arts (MMA)",
  "Motorsports (F1 / NASCAR)",
  "Pickleball",
  "Polo",
  "Rowing",
  "Rugby League / Rugby Union",
  "Sailing",
  "Soccer",
  "Softball",
  "Squash",
  "Swimming",
  "Table Tennis",
  "Taekwondo",
  "Tennis",
  "Volleyball",
  "Water Polo",
  "Weightlifting",
  "Wrestling",
] as const;

/** Same catalog for additional / secondary picks (A–Z). */
export const ADDITIONAL_SPORTS = PRIMARY_SPORTS;

export const OTHER_SPORT_VALUE = "__other__";

/** Combined sports list, A–Z, for dropdowns and pickers. */
export const ALL_SPORTS = PRIMARY_SPORTS;

export type SportName = (typeof PRIMARY_SPORTS)[number];

/** Map stored primary sport to dropdown + optional custom text when "Other". */
export function sportPickerFromStored(stored: string): { select: string; custom: string } {
  const value = stored.trim();
  if (!value) return { select: "Basketball", custom: "" };
  if ((ALL_SPORTS as readonly string[]).includes(value)) return { select: value, custom: "" };
  return { select: OTHER_SPORT_VALUE, custom: value };
}

/** Resolve dropdown + custom input into the value saved to the database. */
export function sportPickerToStored(select: string, custom: string): string {
  if (select === OTHER_SPORT_VALUE) {
    const typed = custom.trim();
    return typed || "Other";
  }
  return select;
}

export function formatEventLocation(city?: string | null, state?: string | null, zip?: string | null) {
  const parts: string[] = [];
  if (city?.trim()) parts.push(city.trim());
  if (state?.trim()) parts.push(state.trim());
  const loc = parts.join(", ");
  if (loc && zip?.trim()) return `${loc} · ZIP ${zip.trim()}`;
  if (loc) return loc;
  if (zip?.trim()) return `ZIP ${zip.trim()}`;
  return "";
}

export function formatPayOffer(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `$${Number(amount).toFixed(2)}`;
}

export type AvailabilityWindow = { start_at: string; end_at: string };
