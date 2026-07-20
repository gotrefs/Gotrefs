import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAppliedBoosts,
  sanitizeBoostIds,
  totalBoostPercent,
  applyBoostToPay,
  type AppliedBoost,
} from "@/lib/boosts";

export type OfferBoost = { percent: number; applied: AppliedBoost[] };

/**
 * Compute the boost that applies to an offer for a specific ref, using live
 * booking counts. Counts are best-effort: if they cannot be loaded, quantity
 * gated boosts simply don't apply.
 */
export async function computeOfferBoost(
  client: SupabaseClient,
  params: {
    organizerMemberId: string;
    refMemberId: string;
    eventStartsAt: string | null | undefined;
    eventBoosts: string[] | null | undefined;
  }
): Promise<OfferBoost> {
  const selected = sanitizeBoostIds(params.eventBoosts);
  if (selected.length === 0) return { percent: 0, applied: [] };

  let organizerAcceptedCount = 0;
  let refAcceptedWithOrganizerCount = 0;
  try {
    const [orgRes, refRes] = await Promise.all([
      client
        .from("assignment_offers")
        .select("id, scheduled_events!inner(organizer_member_id)", { count: "exact", head: true })
        .eq("scheduled_events.organizer_member_id", params.organizerMemberId)
        .eq("status", "accepted"),
      client
        .from("assignment_offers")
        .select("id, scheduled_events!inner(organizer_member_id)", { count: "exact", head: true })
        .eq("scheduled_events.organizer_member_id", params.organizerMemberId)
        .eq("ref_member_id", params.refMemberId)
        .eq("status", "accepted"),
    ]);
    organizerAcceptedCount = orgRes.count ?? 0;
    refAcceptedWithOrganizerCount = refRes.count ?? 0;
  } catch {
    // Best-effort: fall back to zero counts.
  }

  const applied = computeAppliedBoosts({
    eventBoosts: selected,
    eventStartsAt: params.eventStartsAt,
    organizerAcceptedCount,
    refAcceptedWithOrganizerCount,
  });
  return { percent: totalBoostPercent(applied), applied };
}

/** Apply a boost percent to a base pay amount (dollars), preserving null. */
export function boostedOfferPay(basePay: number | null | undefined, percent: number): number | null {
  if (basePay == null || !Number.isFinite(basePay) || percent <= 0) return basePay ?? null;
  return applyBoostToPay(basePay, percent);
}
