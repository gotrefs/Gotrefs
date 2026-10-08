import "server-only";
import { approximateEventCoords } from "@/lib/maps/geo";
import { refHasListingBasics } from "@/lib/marketplace/ref-listing";
import { geocodeZipBatch } from "@/lib/marketplace/zip-geocode";
import { resolveProfilePhotoUrl } from "@/lib/profile-photo";
import { createServiceClient } from "@/lib/supabase/service";

/** A referee as shown on the public Find Refs page. No email, phone or exact address. */
export type PublicRefListing = {
  id: string;
  gotrefsId: string;
  /** First name + last initial, e.g. "Marcus J." */
  name: string;
  initials: string;
  photoUrl: string | null;
  primarySport: string;
  sports: string[];
  certificationLevel: string | null;
  rateUnit: "hour" | "game";
  rateMin: number | null;
  rateMax: number | null;
  place: string | null;
  /** Approximate area (jittered ~2 mi from the ref's ZIP), never an address. */
  coords: { lat: number; lng: number } | null;
  travelRadiusMiles: number | null;
  bio: string;
  /**
   * Passed GotREFS verification. Unverified REFS are listed too (once they have a photo,
   * name, sport and phone) and can be requested; they confirm only after approval.
   * Sample REFS are never verified.
   */
  verified: boolean;
  /** Sample (seed) profile: shown for layout, never bookable. */
  isSample: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  gamesCompleted: number;
};

type ProfileRow = {
  gotrefs_id?: string | null;
  primary_sport?: string | null;
  additional_sports?: string[] | null;
  certification_level?: string | null;
  rate_per_game?: number | null;
  rate_type?: string | null;
  rate_min?: number | null;
  rate_max?: number | null;
  rate_unit?: string | null;
  travel_radius_miles?: number | null;
  bio?: string | null;
};

type MemberRow = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  home_zip: string | null;
  profile_picture_url?: string | null;
  is_seed?: boolean | null;
  /** Read only to decide whether an unverified REF is listed. Never returned. */
  phone?: string | null;
  ref_profiles: ProfileRow[] | ProfileRow | null;
};

const PIN_JITTER_MILES = 2;
const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; refs: PublicRefListing[] } | null = null;

function shortName(m: MemberRow): { name: string; initials: string } {
  const parts = (m.display_name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = (m.first_name ?? "").trim() || parts[0] || "Official";
  const last = (m.last_name ?? "").trim() || (parts.length > 1 ? parts[parts.length - 1] : "");
  const lastInitial = last ? `${last[0].toUpperCase()}.` : "";
  return {
    name: [first, lastInitial].filter(Boolean).join(" "),
    initials: `${first[0] ?? "G"}${last[0] ?? ""}`.toUpperCase(),
  };
}

async function photoUrlFor(
  admin: ReturnType<typeof createServiceClient>,
  value: string | null | undefined
): Promise<string | null> {
  const v = (value ?? "").trim();
  if (!v) return null;
  // Sample ref photos live in web/public/sample-refs and are served as-is.
  if (v.startsWith("/sample-refs/")) return v;
  return resolveProfilePhotoUrl(admin, v, 60 * 60 * 12);
}

/**
 * Every ref that should appear on the public Find Refs page:
 * real refs who are eligible for games (verified), then sample refs.
 */
export async function loadPublicRefListings(): Promise<PublicRefListing[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.refs;

  const admin = createServiceClient();
  // Newest columns first; fall back if a migration hasn't been run on this database yet.
  const baseProfile =
    "gotrefs_id, primary_sport, additional_sports, certification_level, rate_per_game, rate_type, rate_min, rate_max, rate_unit, bio";
  const attempts = [
    `id, display_name, first_name, last_name, home_zip, profile_picture_url, is_seed, phone, ref_profiles ( ${baseProfile}, travel_radius_miles )`,
    `id, display_name, first_name, last_name, home_zip, profile_picture_url, is_seed, phone, ref_profiles ( ${baseProfile} )`,
    `id, display_name, first_name, last_name, home_zip, profile_picture_url, is_seed, ref_profiles ( ${baseProfile}, travel_radius_miles )`,
    `id, display_name, first_name, last_name, home_zip, profile_picture_url, is_seed, ref_profiles ( ${baseProfile} )`,
    `id, display_name, first_name, last_name, home_zip, profile_picture_url, ref_profiles ( ${baseProfile} )`,
    `id, display_name, home_zip, ref_profiles ( gotrefs_id, primary_sport, rate_per_game, rate_type, rate_min, rate_max, rate_unit )`,
  ];
  let result: { data: unknown[] | null; error: { message: string } | null } = { data: null, error: null };
  for (const columns of attempts) {
    result = await admin.from("members").select(columns).eq("role", "ref");
    if (!result.error) break;
    console.warn("[public-refs] select fallback:", result.error.message);
  }
  if (result.error) throw new Error(result.error.message);
  const members = (result.data ?? []) as MemberRow[];

  // Real REFS appear once verified, or before that once they have a photo, name, sport and phone.
  const eligibleIds = new Set<string>();
  const listedIds = new Set<string>();
  await Promise.all(
    members
      .filter((m) => !m.is_seed)
      .map(async (m) => {
        const { data: ok } = await admin.rpc("ref_is_offer_eligible", { ref_id: m.id });
        if (ok) {
          eligibleIds.add(m.id);
          return;
        }
        const rp = Array.isArray(m.ref_profiles) ? m.ref_profiles[0] : m.ref_profiles;
        let phone = m.phone ?? null;
        if (!phone) {
          const { data } = await admin.auth.admin.getUserById(m.id);
          const metaPhone = data?.user?.user_metadata?.phone;
          phone = typeof metaPhone === "string" ? metaPhone : null;
        }
        if (
          refHasListingBasics({
            firstName: m.first_name,
            lastName: m.last_name,
            displayName: m.display_name,
            photo: m.profile_picture_url,
            sport: rp?.primary_sport,
            phone,
          })
        ) {
          listedIds.add(m.id);
        }
      })
  );
  const shown = members.filter((m) => m.is_seed || eligibleIds.has(m.id) || listedIds.has(m.id));
  const realIds = shown.filter((m) => !m.is_seed).map((m) => m.id);
  const emptyId = "00000000-0000-0000-0000-000000000000";

  const [zipCoords, ratingsRes, bookingsRes] = await Promise.all([
    geocodeZipBatch(shown.map((m) => m.home_zip ?? "").filter(Boolean)),
    admin
      .from("ref_ratings")
      .select("ref_member_id, score")
      .in("ref_member_id", realIds.length ? realIds : [emptyId])
      .eq("skipped", false)
      .not("score", "is", null),
    admin
      .from("bookings")
      .select("ref_member_id")
      .in("ref_member_id", realIds.length ? realIds : [emptyId])
      .in("status", ["confirmed", "completed"]),
  ]);

  const metaRadiusByRef = new Map<string, number>();
  await Promise.all(
    shown
      .filter((m) => !m.is_seed)
      .map(async (m) => {
        const rp = Array.isArray(m.ref_profiles) ? m.ref_profiles[0] : m.ref_profiles;
        if (typeof rp?.travel_radius_miles === "number") return;
        const { data } = await admin.auth.admin.getUserById(m.id);
        const raw = Number(data?.user?.user_metadata?.travel_radius_miles);
        if (Number.isFinite(raw) && raw > 0) metaRadiusByRef.set(m.id, Math.round(raw));
      })
  );

  const ratingByRef = new Map<string, { total: number; count: number }>();
  for (const r of ratingsRes.data ?? []) {
    if (typeof r.score !== "number") continue;
    const cur = ratingByRef.get(r.ref_member_id) ?? { total: 0, count: 0 };
    cur.total += r.score;
    cur.count += 1;
    ratingByRef.set(r.ref_member_id, cur);
  }
  const gamesByRef = new Map<string, number>();
  for (const b of bookingsRes.data ?? []) {
    gamesByRef.set(b.ref_member_id, (gamesByRef.get(b.ref_member_id) ?? 0) + 1);
  }

  const refs = await Promise.all(
    shown.map(async (m): Promise<PublicRefListing> => {
      const rp = (Array.isArray(m.ref_profiles) ? m.ref_profiles[0] : m.ref_profiles) ?? {};
      const isSample = m.is_seed === true;
      const { name, initials } = shortName(m);
      const primarySport = rp.primary_sport?.trim() || "Basketball";
      const extra = Array.isArray(rp.additional_sports) ? rp.additional_sports.filter(Boolean) : [];
      const exact = typeof rp.rate_per_game === "number" ? Number(rp.rate_per_game) : null;
      const isRange = rp.rate_type === "range" && rp.rate_min != null && rp.rate_max != null;
      const zip = (m.home_zip ?? "").trim().slice(0, 5);
      const zc = zipCoords.get(zip);
      // Sample refs never carry ratings or game history.
      const rating = isSample ? undefined : ratingByRef.get(m.id);

      return {
        id: m.id,
        gotrefsId: rp.gotrefs_id?.trim() || `GR-${m.id.slice(0, 8).toUpperCase()}`,
        name,
        initials,
        photoUrl: await photoUrlFor(admin, m.profile_picture_url),
        primarySport,
        sports: [primarySport, ...extra.filter((s) => s !== primarySport)],
        certificationLevel: rp.certification_level?.trim() || null,
        rateUnit: rp.rate_unit === "game" ? "game" : "hour",
        rateMin: isRange ? Number(rp.rate_min) : exact,
        rateMax: isRange ? Number(rp.rate_max) : exact,
        place: zc?.place ?? null,
        coords: zc ? approximateEventCoords(zc, m.id, PIN_JITTER_MILES) : null,
        travelRadiusMiles:
          typeof rp.travel_radius_miles === "number" ? rp.travel_radius_miles : metaRadiusByRef.get(m.id) ?? null,
        bio: (rp.bio ?? "").trim(),
        verified: !isSample && eligibleIds.has(m.id),
        isSample,
        ratingAverage: rating?.count ? Number((rating.total / rating.count).toFixed(1)) : null,
        ratingCount: rating?.count ?? 0,
        gamesCompleted: isSample ? 0 : gamesByRef.get(m.id) ?? 0,
      };
    })
  );

  cache = { at: Date.now(), refs };
  return refs;
}

