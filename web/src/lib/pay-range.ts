export type PayRangeInput = {
  type?: "exact" | "range" | null;
  exact?: number | null;
  min?: number | null;
  max?: number | null;
};

export function payBounds(input: PayRangeInput): { min: number | null; max: number | null } {
  const type = input.type === "range" ? "range" : "exact";
  if (type === "range") {
    const min = input.min ?? input.exact ?? null;
    const max = input.max ?? min;
    return { min, max };
  }
  const exact = input.exact ?? input.min ?? null;
  return { min: exact, max: exact };
}

/** True when both sides have no pay set, or their ranges overlap. */
export function payRangesOverlap(a: PayRangeInput, b: PayRangeInput): boolean {
  const boundsA = payBounds(a);
  const boundsB = payBounds(b);
  if (boundsA.min == null && boundsB.min == null) return true;
  if (boundsA.min == null || boundsB.min == null) return true;
  const maxA = boundsA.max ?? boundsA.min;
  const maxB = boundsB.max ?? boundsB.min;
  return boundsA.min <= maxB && boundsB.min <= maxA;
}

export function formatHourlyRateRange(min: number, max?: number | null) {
  const floor = Number(min);
  if (!Number.isFinite(floor)) return "Rate TBD";
  if (max != null && Number.isFinite(max) && max > floor) {
    return `$${floor.toFixed(0)}–$${Number(max).toFixed(0)}/hr`;
  }
  return `$${floor.toFixed(0)}/hr`;
}

export function formatPayRangeLabel(value: PayRangeInput & { unit?: "hour" | "game" }) {
  const unit = value.unit === "game" ? "game" : "hr";
  const bounds = payBounds(value);
  if (bounds.min == null) return null;
  const max = bounds.max ?? bounds.min;
  if (value.type === "range" && max > bounds.min) {
    return `$${bounds.min.toFixed(0)}–$${max.toFixed(0)}/${unit}`;
  }
  return `$${bounds.min.toFixed(0)}/${unit}`;
}
