export const PRIMARY_SPORTS = [
  "Basketball",
  "Football",
  "Soccer",
  "Baseball",
  "Softball",
  "Volleyball",
  "Hockey",
  "Lacrosse",
  "Wrestling",
  "Tennis",
  "Golf",
  "Swimming",
  "Track & Field",
  "Cross Country",
  "Cheerleading",
  "Dance",
  "Martial Arts",
] as const;

export const ADDITIONAL_SPORTS = [
  "7v7 Football",
  "Flag Football",
  "11v11 Football",
  "5v5 Basketball",
  "3v3 Basketball",
  "Indoor Soccer",
  "Futsal",
  "Rugby",
  "Field Hockey",
  "Ice Hockey",
  "Roller Hockey",
  "Pickleball",
  "Badminton",
  "Cricket",
  "Ultimate Frisbee",
  "Water Polo",
  "Gymnastics",
  "Esports",
] as const;

export const OTHER_SPORT_VALUE = "__other__";

export const ALL_SPORTS = [...PRIMARY_SPORTS, ...ADDITIONAL_SPORTS] as const;

export type SportName = (typeof ALL_SPORTS)[number];

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
