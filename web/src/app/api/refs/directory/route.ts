import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/mask-email";
import { isOrganizerMember } from "@/lib/organizer-access";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { sportEmoji } from "@/lib/sport-emoji";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type AvailabilitySlot = { start_at: string; end_at: string };

type RefProfileRow = {
  primary_sport?: string | null;
  additional_sports?: string[] | null;
  rate_per_game?: number | null;
  rate_type?: string | null;
  rate_min?: number | null;
  rate_max?: number | null;
  gotrefs_id?: string | null;
  rate_unit?: string | null;
  travel_radius_miles?: number | null;
  certification_level?: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in.", canContact: false, refs: [] }, { status: 401 });
  }

  const canContact = await isOrganizerMember(supabase, user);
  if (!canContact) {
    return NextResponse.json({
      canContact: false,
      refs: [],
      message: "Only registered event organizers can browse ref availability and contact refs.",
    });
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  const membersResult = await admin
    .from("members")
    .select(
      "id, display_name, home_zip, profile_picture_url, ref_profiles ( primary_sport, additional_sports, rate_per_game, rate_type, rate_min, rate_max, gotrefs_id, rate_unit, travel_radius_miles, certification_level )"
    )
    .eq("role", "ref");
  let members: Array<{
    id: string;
    display_name: string;
    home_zip: string | null;
    profile_picture_url?: string | null;
    ref_profiles: RefProfileRow[] | RefProfileRow | null;
  }> | null = membersResult.data as typeof members;
  let memErr = membersResult.error;

  if (memErr) {
    const fallback = await admin
      .from("members")
      .select(
        "id, display_name, home_zip, ref_profiles ( primary_sport, rate_per_game, rate_type, rate_min, rate_max, gotrefs_id, rate_unit )"
      )
      .eq("role", "ref");
    members = (fallback.data as typeof members) ?? null;
    memErr = fallback.error;
  }

  if (memErr) {
    console.error("[api/refs/directory]", memErr.message);
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  const refIds = (members ?? []).map((m) => m.id);
  const emptyId = "00000000-0000-0000-0000-000000000000";
  const idFilter = refIds.length > 0 ? refIds : [emptyId];

  const [{ data: availability }, { data: ratings }, { data: bookings }] = await Promise.all([
    admin
      .from("ref_availability")
      .select("ref_member_id, start_at, end_at")
      .in("ref_member_id", idFilter)
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true }),
    admin
      .from("ref_ratings")
      .select("ref_member_id, score, comment, created_at, organizer_member_id, skipped")
      .in("ref_member_id", idFilter)
      .eq("skipped", false)
      .not("score", "is", null)
      .order("created_at", { ascending: false }),
    admin
      .from("bookings")
      .select("ref_member_id, status")
      .in("ref_member_id", idFilter)
      .in("status", ["confirmed", "completed"]),
  ]);

  const availByRef = new Map<string, AvailabilitySlot[]>();
  for (const slot of availability ?? []) {
    const list = availByRef.get(slot.ref_member_id) ?? [];
    list.push({ start_at: slot.start_at, end_at: slot.end_at });
    availByRef.set(slot.ref_member_id, list);
  }

  const gamesByRef = new Map<string, number>();
  for (const booking of bookings ?? []) {
    gamesByRef.set(booking.ref_member_id, (gamesByRef.get(booking.ref_member_id) ?? 0) + 1);
  }

  const orgIds = [...new Set((ratings ?? []).map((r) => r.organizer_member_id).filter(Boolean))];
  const { data: orgMembers } =
    orgIds.length > 0
      ? await admin.from("members").select("id, display_name").in("id", orgIds)
      : { data: [] as { id: string; display_name: string }[] };
  const orgNameById = new Map((orgMembers ?? []).map((m) => [m.id, m.display_name]));

  const ratingByRef = new Map<
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
    const next = ratingByRef.get(rating.ref_member_id) ?? { total: 0, count: 0, reviews: [] };
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
    ratingByRef.set(rating.ref_member_id, next);
  }

  const refs = [];
  for (const m of members ?? []) {
    const { data: eligible } = await admin.rpc("ref_is_offer_eligible", { ref_id: m.id });
    if (!eligible) continue;

    const rp = Array.isArray(m.ref_profiles) ? m.ref_profiles[0] : m.ref_profiles;
    const primarySport = rp?.primary_sport ?? "Basketball";
    const additionalSports = Array.isArray(rp?.additional_sports) ? rp.additional_sports : [];

    const { data: authUser } = await admin.auth.admin.getUserById(m.id);
    const email = authUser?.user?.email ?? "";
    const gotrefsId =
      (typeof rp?.gotrefs_id === "string" && rp.gotrefs_id) ||
      (typeof authUser?.user?.user_metadata?.gotrefs_id === "string"
        ? authUser.user.user_metadata.gotrefs_id
        : `GR-${m.id.slice(0, 8).toUpperCase()}`);
    const maskedEmail = email ? maskEmail(email) : "•••@•••.•••";
    const rating = ratingByRef.get(m.id);
    const avatarUrl = await resolveProfilePhotoUrl(admin, m.profile_picture_url ?? null);

    refs.push({
      id: m.id,
      gotrefsId,
      displayName: m.display_name,
      primarySport,
      additionalSports,
      certificationLevel: rp?.certification_level ?? null,
      sportEmoji: sportEmoji(primarySport),
      ratePerGame: rp?.rate_per_game ?? null,
      rateType: rp?.rate_type === "range" ? "range" : "exact",
      rateMin: rp?.rate_min ?? null,
      rateMax: rp?.rate_max ?? null,
      rateUnit: rp?.rate_unit === "game" ? "game" : "hour",
      homeZip: m.home_zip,
      travelRadiusMiles:
        typeof rp?.travel_radius_miles === "number" ? rp.travel_radius_miles : null,
      availability: availByRef.get(m.id) ?? [],
      maskedEmail,
      avatarUrl,
      ratingAverage: rating?.count ? Number((rating.total / rating.count).toFixed(1)) : null,
      ratingCount: rating?.count ?? 0,
      reviews: rating?.reviews ?? [],
      gamesCompleted: gamesByRef.get(m.id) ?? 0,
    });
  }

  return NextResponse.json({ canContact: true, refs });
}
