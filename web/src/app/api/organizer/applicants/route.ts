import { NextResponse } from "next/server";
import { isOrganizerMember } from "@/lib/organizer-access";
import { payBounds } from "@/lib/pay-range";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type ApplicantRow = {
  id: string;
  event_id: string;
  ref_member_id: string;
  created_at: string;
  scheduled_events:
    | {
        title: string;
        pay_offer: number | null;
        pay_type?: string | null;
        pay_min?: number | null;
        pay_max?: number | null;
        organizer_member_id: string;
      }
    | Array<{
        title: string;
        pay_offer: number | null;
        pay_type?: string | null;
        pay_min?: number | null;
        pay_max?: number | null;
        organizer_member_id: string;
      }>
    | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", applicants: [] }, { status: 401 });
  }

  const canView = await isOrganizerMember(supabase, user);
  if (!canView) {
    return NextResponse.json({ applicants: [] });
  }

  const { data: rows, error } = await supabase
    .from("event_signup_requests")
    .select(
      "id, event_id, ref_member_id, created_at, scheduled_events!inner ( title, pay_offer, pay_type, pay_min, pay_max, organizer_member_id )"
    )
    .eq("scheduled_events.organizer_member_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message, applicants: [] }, { status: 400 });
  }

  const applicants = (rows ?? []) as ApplicantRow[];
  const refIds = Array.from(new Set(applicants.map((row) => row.ref_member_id)));

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error.", applicants: [] }, { status: 503 });
  }

  const { data: profiles } = await admin
    .from("ref_profiles")
    .select("member_id, gotrefs_id, rate_type, rate_min, rate_max, rate_per_game, rate_unit")
    .in("member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileByRef = new Map((profiles ?? []).map((profile) => [profile.member_id, profile]));

  const { data: ratings } = await admin
    .from("ref_ratings")
    .select("ref_member_id, score, skipped, comment, created_at, organizer_member_id")
    .in("ref_member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("skipped", false)
    .not("score", "is", null)
    .order("created_at", { ascending: false });

  const orgIds = [...new Set((ratings ?? []).map((r) => r.organizer_member_id).filter(Boolean))];
  const { data: orgMembers } =
    orgIds.length > 0
      ? await admin.from("members").select("id, display_name").in("id", orgIds)
      : { data: [] as { id: string; display_name: string }[] };
  const orgNameById = new Map((orgMembers ?? []).map((m) => [m.id, m.display_name]));

  const ratingSummaryByRef = new Map<
    string,
    {
      total: number;
      count: number;
      reviews: Array<{
        score: number;
        comment: string | null;
        createdAt: string;
        authorLabel: string;
      }>;
    }
  >();
  for (const rating of ratings ?? []) {
    if (typeof rating.score !== "number") continue;
    const next = ratingSummaryByRef.get(rating.ref_member_id) ?? { total: 0, count: 0, reviews: [] };
    next.total += rating.score;
    next.count += 1;
    if (next.reviews.length < 8) {
      next.reviews.push({
        score: rating.score,
        comment: rating.comment ?? null,
        createdAt: rating.created_at,
        authorLabel: orgNameById.get(rating.organizer_member_id)?.trim() || "Host",
      });
    }
    ratingSummaryByRef.set(rating.ref_member_id, next);
  }

  const enriched = [];
  for (const row of applicants) {
    const event = Array.isArray(row.scheduled_events) ? row.scheduled_events[0] : row.scheduled_events;
    const profile = profileByRef.get(row.ref_member_id);
    const rating = ratingSummaryByRef.get(row.ref_member_id);

    let gotrefsId = profile?.gotrefs_id ?? null;
    if (!gotrefsId) {
      const { data: authUser } = await admin.auth.admin.getUserById(row.ref_member_id);
      gotrefsId =
        typeof authUser?.user?.user_metadata?.gotrefs_id === "string"
          ? authUser.user.user_metadata.gotrefs_id
          : `GR-${row.ref_member_id.slice(0, 8).toUpperCase()}`;
    }

    const refBounds = payBounds({
      type: profile?.rate_type === "range" ? "range" : "exact",
      exact: profile?.rate_per_game,
      min: profile?.rate_min,
      max: profile?.rate_max,
    });
    const eventBounds = payBounds({
      type: event?.pay_type === "range" ? "range" : "exact",
      exact: event?.pay_offer,
      min: event?.pay_min,
      max: event?.pay_max,
    });

    enriched.push({
      id: row.id,
      eventId: row.event_id,
      refMemberId: row.ref_member_id,
      createdAt: row.created_at,
      gotrefsId,
      eventTitle: event?.title ?? "Event",
      eventPayLabel:
        eventBounds.min != null
          ? eventBounds.max != null && eventBounds.max > eventBounds.min
            ? `$${eventBounds.min}-$${eventBounds.max}`
            : `$${eventBounds.min}`
          : null,
      refRateLabel:
        refBounds.min != null
          ? refBounds.max != null && refBounds.max > refBounds.min
            ? `$${refBounds.min}-$${refBounds.max}/${profile?.rate_unit === "game" ? "game" : "hr"}`
            : `$${refBounds.min}/${profile?.rate_unit === "game" ? "game" : "hr"}`
          : null,
      ratingAverage: rating?.count ? Number((rating.total / rating.count).toFixed(1)) : null,
      ratingCount: rating?.count ?? 0,
      reviews: rating?.reviews ?? [],
    });
  }

  return NextResponse.json({ applicants: enriched });
}
