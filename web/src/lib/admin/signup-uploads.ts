import type { SupabaseClient } from "@supabase/supabase-js";
import { siteAssetPhotoPath } from "@/lib/profile-photo";

export type SignupUploadKind = "photo" | "gov_id_front" | "gov_id_back" | "certification" | "other";

export type SignupUploadFile = {
  kind: SignupUploadKind;
  label: string;
  name: string;
  uploadedAt: string | null;
  /** Short-lived link to the private file. Null if it could not be opened. */
  url: string | null;
  isImage: boolean;
};

export type SignupUploads = {
  person: {
    id: string;
    role: "ref" | "organizer" | "unknown";
    name: string;
    email: string;
    phone: string;
    sport: string;
    additionalSports: string[];
    organization: string;
    gotrefsId: string;
    certificationLevel: string;
    /** ref_verification_submissions.status, or null when nothing was ever submitted. */
    verificationStatus: string | null;
    photoUrl: string | null;
  };
  files: SignupUploadFile[];
};

const BUCKET = "verification_documents";
/** Links stop working after this, so a copied link can't be reused later. */
const LINK_SECONDS = 15 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KINDS: Array<{ kind: SignupUploadKind; prefix: string; label: string }> = [
  { kind: "photo", prefix: "profile_photo_", label: "Profile photo" },
  { kind: "gov_id_front", prefix: "gov_id_front_", label: "Government ID (front)" },
  { kind: "gov_id_back", prefix: "gov_id_back_", label: "Government ID (back)" },
  { kind: "certification", prefix: "certification_", label: "Certification" },
];
const ORDER: SignupUploadKind[] = ["gov_id_front", "gov_id_back", "certification", "photo", "other"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function classify(name: string): { kind: SignupUploadKind; label: string } {
  const lower = name.toLowerCase();
  const match = KINDS.find(({ prefix }) => lower.startsWith(prefix));
  return match ? { kind: match.kind, label: match.label } : { kind: "other", label: "Other file" };
}

function looksLikeImage(name: string) {
  return /\.(jpe?g|png|webp|gif|heic)$/i.test(name);
}

/** Only this member's own folder, never a path that climbs out of it. */
function ownPath(memberId: string, path: unknown): string | null {
  const value = text(path).replace(/^\/+/, "");
  if (!value || value.includes("..")) return null;
  return value.startsWith(`${memberId}/`) ? value : null;
}

/**
 * Everything one person has uploaded, for the admin "Uploaded info" view:
 * their card details plus links to their private files.
 * Returns null when there is no such account.
 */
export async function loadSignupUploads(admin: SupabaseClient, memberId: string): Promise<SignupUploads | null> {
  if (!UUID.test(memberId)) return null;

  const [{ data: authData }, memberRes, profileRes, submissionRes, listRes] = await Promise.all([
    admin.auth.admin.getUserById(memberId),
    // "*" so a column this database doesn't have yet can never fail the query.
    admin.from("members").select("*").eq("id", memberId).maybeSingle(),
    admin.from("ref_profiles").select("*").eq("member_id", memberId).maybeSingle(),
    admin.from("ref_verification_submissions").select("status").eq("ref_member_id", memberId).maybeSingle(),
    admin.storage.from(BUCKET).list(memberId, { limit: 100, sortBy: { column: "created_at", order: "desc" } }),
  ]);

  const user = authData?.user ?? null;
  const member = (memberRes.data ?? null) as Record<string, unknown> | null;
  if (!user && !member) return null;
  const profile = (profileRes.data ?? null) as Record<string, unknown> | null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;

  const rawRole = text(member?.role) || text(meta.role);
  const role = rawRole === "ref" || rawRole === "organizer" ? rawRole : "unknown";
  const name =
    [text(member?.first_name) || text(meta.first_name), text(member?.last_name) || text(meta.last_name)]
      .filter(Boolean)
      .join(" ") ||
    text(member?.display_name) ||
    text(meta.full_name);

  // Files in the member's folder, newest first, plus any path saved on the profile that the listing missed.
  type Entry = { path: string; name: string; uploadedAt: string | null };
  const entries: Entry[] = (listRes.data ?? [])
    .filter((item) => item.name && item.id !== null && !item.name.startsWith("."))
    .map((item) => ({
      path: `${memberId}/${item.name}`,
      name: item.name,
      uploadedAt: item.updated_at ?? item.created_at ?? null,
    }));
  const known = new Set(entries.map((entry) => entry.path));
  for (const saved of [
    profile?.government_id_path,
    profile?.verification_doc_path,
    profile?.certification_document_path,
    profile?.external_proof_path,
    member?.profile_picture_url,
  ]) {
    const path = ownPath(memberId, saved);
    if (path && !known.has(path)) {
      known.add(path);
      entries.push({ path, name: path.split("/").pop() ?? path, uploadedAt: null });
    }
  }

  const urlByPath = new Map<string, string>();
  if (entries.length > 0) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(
      entries.map((entry) => entry.path),
      LINK_SECONDS
    );
    for (const row of signed ?? []) {
      if (row.path && row.signedUrl) urlByPath.set(row.path, row.signedUrl);
    }
  }

  const files: SignupUploadFile[] = entries
    .map((entry) => ({
      ...classify(entry.name),
      name: entry.name,
      uploadedAt: entry.uploadedAt,
      url: urlByPath.get(entry.path) ?? null,
      isImage: looksLikeImage(entry.name),
    }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  // The photo on their card: the newest uploaded photo, else a sample/site photo, else an OAuth avatar.
  const newestPhoto = files.find((file) => file.kind === "photo" && file.url)?.url ?? null;
  const savedPhoto = text(member?.profile_picture_url);
  const photoUrl =
    newestPhoto ||
    siteAssetPhotoPath(savedPhoto) ||
    (/^https?:\/\//i.test(savedPhoto) ? savedPhoto : null) ||
    (/^https?:\/\//i.test(text(meta.avatar_url)) ? text(meta.avatar_url) : null);

  const additionalSports = Array.isArray(profile?.additional_sports)
    ? (profile?.additional_sports as unknown[]).filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    : [];

  return {
    person: {
      id: memberId,
      role,
      name,
      email: text(user?.email) || text(member?.email),
      phone: text(member?.phone) || text(meta.phone),
      sport: role === "ref" ? text(profile?.primary_sport) || text(meta.primary_sport) : "",
      additionalSports: role === "ref" ? additionalSports : [],
      organization: text(member?.organization_name) || text(meta.organization_name),
      gotrefsId: role === "ref" ? text(profile?.gotrefs_id) || text(meta.gotrefs_id) : "",
      certificationLevel: role === "ref" ? text(profile?.certification_level) : "",
      verificationStatus: text((submissionRes.data as { status?: string } | null)?.status) || null,
      photoUrl,
    },
    files,
  };
}
