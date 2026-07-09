import { NextResponse } from "next/server";
import { maskEmail } from "@/lib/mask-email";
import { isOrganizerMember } from "@/lib/organizer-access";
import { sportEmoji } from "@/lib/sport-emoji";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type AvailabilitySlot = { start_at: string; end_at: string };

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
    .select("id, display_name, home_zip, ref_profiles ( primary_sport, rate_per_game, rate_type, rate_min, rate_max, gotrefs_id, rate_unit )")
    .eq("role", "ref");
  let members: Array<{
    id: string;
    display_name: string;
    home_zip: string | null;
    ref_profiles:
      | Array<{
          primary_sport?: string | null;
          rate_per_game?: number | null;
          rate_type?: string | null;
          rate_min?: number | null;
          rate_max?: number | null;
          gotrefs_id?: string | null;
          rate_unit?: string | null;
        }>
      | {
          primary_sport?: string | null;
          rate_per_game?: number | null;
          rate_type?: string | null;
          rate_min?: number | null;
          rate_max?: number | null;
          gotrefs_id?: string | null;
          rate_unit?: string | null;
        }
      | null;
  }> | null = membersResult.data;
  let memErr = membersResult.error;
  if (memErr?.message.includes("rate_type")) {
    const fallback = await admin
      .from("members")
      .select("id, display_name, home_zip, ref_profiles ( primary_sport, rate_per_game )")
      .eq("role", "ref");
    members = fallback.data;
    memErr = fallback.error;
  }

  if (memErr) {
    console.error("[api/refs/directory]", memErr.message);
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  const refIds = (members ?? []).map((m) => m.id);
  const { data: availability } = await admin
    .from("ref_availability")
    .select("ref_member_id, start_at, end_at")
    .in("ref_member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true });

  const availByRef = new Map<string, AvailabilitySlot[]>();
  for (const slot of availability ?? []) {
    const list = availByRef.get(slot.ref_member_id) ?? [];
    list.push({ start_at: slot.start_at, end_at: slot.end_at });
    availByRef.set(slot.ref_member_id, list);
  }

  const { data: ratings } = await admin
    .from("ref_ratings")
    .select("ref_member_id, score, skipped, comment, created_at")
    .in("ref_member_id", refIds.length > 0 ? refIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("skipped", false)
    .not("score", "is", null)
    .order("created_at", { ascending: false });

  const ratingByRef = new Map<
    string,
    { total: number; count: number; reviews: Array<{ score: number; comment: string | null; createdAt: string }> }
  >();
  for (const rating of ratings ?? []) {
    if (typeof rating.score !== "number") continue;
    const next = ratingByRef.get(rating.ref_member_id) ?? { total: 0, count: 0, reviews: [] };
    next.total += rating.score;
    next.count += 1;
    if (next.reviews.length < 3) {
      next.reviews.push({
        score: rating.score,
        comment: rating.comment ?? null,
        createdAt: rating.created_at,
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

    const { data: authUser } = await admin.auth.admin.getUserById(m.id);
    const email = authUser?.user?.email ?? "";
    const gotrefsId =
      (typeof rp?.gotrefs_id === "string" && rp.gotrefs_id) ||
      (typeof authUser?.user?.user_metadata?.gotrefs_id === "string"
        ? authUser.user.user_metadata.gotrefs_id
        : `GR-${m.id.slice(0, 8).toUpperCase()}`);
    const maskedEmail = email ? maskEmail(email) : "•••@•••.•••";
    const rating = ratingByRef.get(m.id);

    refs.push({
      id: m.id,
      gotrefsId,
      displayName: m.display_name,
      primarySport,
      sportEmoji: sportEmoji(primarySport),
      ratePerGame: rp?.rate_per_game ?? null,
      rateType: rp?.rate_type === "range" ? "range" : "exact",
      rateMin: rp?.rate_min ?? null,
      rateMax: rp?.rate_max ?? null,
      rateUnit: rp?.rate_unit === "game" ? "game" : "hour",
      homeZip: m.home_zip,
      availability: availByRef.get(m.id) ?? [],
      maskedEmail,
      ratingAverage: rating?.count ? Number((rating.total / rating.count).toFixed(1)) : null,
      ratingCount: rating?.count ?? 0,
      reviews: rating?.reviews ?? [],
    });
  }

  return NextResponse.json({ canContact: true, refs });
}
