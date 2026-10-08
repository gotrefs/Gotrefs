import { PLATFORM_FEE_RATE } from "@/lib/platform-fee";

export type PayUnit = "game" | "hour";
export type TimesheetStatus = "checked_in" | "awaiting_ref" | "approved" | "disputed";

export type Timesheet = {
  booking_id: string;
  event_id: string;
  ref_member_id: string;
  organizer_member_id: string;
  pay_unit: PayUnit;
  rate: number | null;
  booked_units: number;
  checked_in_at: string | null;
  checked_out_at: string | null;
  worked_units: number | null;
  units_edited: boolean;
  status: TimesheetStatus;
  submitted_at: string | null;
  ref_decided_at: string | null;
  dispute_note: string | null;
  /** Set once the REF has been paid and the organizer charged/refunded the difference. */
  auto_approved?: boolean;
  settled_at?: string | null;
  ref_pay_cents?: number | null;
  organizer_adjust_cents?: number | null;
  adjust_status?: "none" | "charged" | "refunded" | "charge_failed" | "refund_failed" | null;
  adjust_payment_id?: string | null;
  settle_error?: string | null;
};

/** How long a REF has to sign off (or an organizer to clock out) before GotREFS approves it as-is. */
export const AUTO_APPROVE_MS = 48 * 60 * 60 * 1000;

/** Check-in opens this long before the event starts… */
export const CHECK_IN_OPENS_MS = 6 * 60 * 60 * 1000;
/** …and stays open this long after it was scheduled to end (tournaments run late). */
export const CHECK_IN_CLOSES_MS = 12 * 60 * 60 * 1000;

export function checkInWindowOpen(event: { starts_at: string; ends_at: string }, now = Date.now()) {
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  return now >= start - CHECK_IN_OPENS_MS && now <= end + CHECK_IN_CLOSES_MS;
}

/** Hours on the clock: nearest 15 minutes, never under 1 hour. */
export function hoursFromClock(checkedInAt: string, checkedOutAt: string): number {
  const ms = Math.max(0, new Date(checkedOutAt).getTime() - new Date(checkedInAt).getTime());
  const quarters = Math.round(ms / (15 * 60 * 1000));
  return Math.max(1, quarters / 4);
}

/** Whole games or quarter hours, within sane limits. Null if the value isn't usable. */
export function cleanUnits(value: unknown, unit: PayUnit): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 200) return null;
  return unit === "game" ? Math.round(n) : Math.round(n * 4) / 4;
}

/** The REF signs off whenever the total differs from the booking or the hours were edited. */
export function needsRefSignoff(sheet: Pick<Timesheet, "worked_units" | "booked_units" | "units_edited">) {
  return sheet.units_edited || Number(sheet.worked_units ?? 0) !== Number(sheet.booked_units);
}

const money = (n: number) => Math.round(n * 100) / 100;

/**
 * What changes once the timesheet is approved. Organizers pay the REF's rate plus the
 * platform fee on the total; extra work is charged after the event, unused work refunded.
 */
export function timesheetMoney(sheet: Pick<Timesheet, "rate" | "booked_units" | "worked_units">) {
  const rate = Number(sheet.rate ?? 0);
  const booked = Number(sheet.booked_units ?? 0);
  const worked = Number(sheet.worked_units ?? booked);
  const diffUnits = worked - booked;
  const refPayDiff = money(diffUnits * rate);
  const feeDiff = money(refPayDiff * PLATFORM_FEE_RATE);
  return {
    rate,
    booked,
    worked,
    diffUnits,
    refPay: money(worked * rate),
    /** Positive: charge the organizer this after sign-off. Negative: refund it. */
    organizerDiff: money(refPayDiff + feeDiff),
  };
}

export function unitLabel(unit: PayUnit, n: number) {
  if (unit === "hour") return `${n} hour${n === 1 ? "" : "s"}`;
  return `${n} game${n === 1 ? "" : "s"}`;
}

/**
 * Money after sign-off, in cents. The organizer already paid booked × rate + 20%.
 * The REF gets worked × rate; the organizer is charged (positive) or refunded (negative)
 * the difference plus the 20% on that difference.
 */
export function settlementCents(args: { rateCents: number; bookedUnits: number; workedUnits: number }) {
  const rate = Math.max(0, Math.round(args.rateCents));
  const booked = Math.max(0, Number(args.bookedUnits) || 0);
  const worked = Math.max(0, Number(args.workedUnits) || 0);
  const refPayCents = Math.round(rate * worked);
  const bookedPayCents = Math.round(rate * booked);
  const diff = refPayCents - bookedPayCents;
  const fee = Math.round(Math.abs(diff) * PLATFORM_FEE_RATE);
  const adjustCents = diff === 0 ? 0 : diff > 0 ? diff + fee : diff - fee;
  return { refPayCents, bookedPayCents, diffCents: diff, adjustCents };
}
