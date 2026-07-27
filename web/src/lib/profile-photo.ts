import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a profile photo for display. Values may be a full URL (OAuth) or a
 * private `verification_documents` storage path that needs a signed URL.
 */
export async function resolveProfilePhotoUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  const value = (pathOrUrl ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  // Normalize accidental leading slashes from older writes.
  const path = value.replace(/^\/+/, "");

  const { data, error } = await supabase.storage
    .from("verification_documents")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** True when the value is a GotRefs storage path (uploaded face photo), not an OAuth URL. */
export function isUploadedProfilePhotoPath(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v || /^https?:\/\//i.test(v) || v.startsWith("blob:")) return false;
  return true;
}

/**
 * If members.profile_picture_url is empty but a profile_photo_* file exists in
 * the member's storage folder (e.g. an earlier DB update failed), recover it.
 */
export async function findStoredProfilePhotoPath(
  supabase: SupabaseClient,
  memberId: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("verification_documents").list(memberId, {
    limit: 50,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data?.length) return null;

  const match = data.find((item) => item.name.toLowerCase().startsWith("profile_photo_"));
  return match ? `${memberId}/${match.name}` : null;
}

/**
 * Choose the best profile photo source for a member.
 * Uploaded GotRefs face photos (storage) always beat OAuth/provider image URLs.
 */
export async function pickProfilePhotoSource(
  supabase: SupabaseClient,
  memberId: string,
  ...candidates: Array<string | null | undefined>
): Promise<string | null> {
  const cleaned = candidates
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .map((value) => value.replace(/^\/+/, ""));

  const uploadedCandidate = cleaned.find((value) => isUploadedProfilePhotoPath(value));
  if (uploadedCandidate) return uploadedCandidate;

  const stored = await findStoredProfilePhotoPath(supabase, memberId);
  if (stored) return stored;

  return cleaned.find((value) => /^https?:\/\//i.test(value)) ?? null;
}

/**
 * Resolve a displayable avatar URL and backfill members + auth metadata when we
 * recover an uploaded storage photo that was never (or no longer) saved on the row.
 */
export async function loadMemberProfilePhotoUrl(
  supabase: SupabaseClient,
  memberId: string,
  candidates: Array<string | null | undefined>,
  options?: { expiresInSeconds?: number; persist?: boolean }
): Promise<string | null> {
  const source = await pickProfilePhotoSource(supabase, memberId, ...candidates);
  if (!source) return null;

  if (options?.persist !== false && isUploadedProfilePhotoPath(source)) {
    const current = (candidates[0] ?? "").trim();
    if (current !== source) {
      void supabase.from("members").update({ profile_picture_url: source }).eq("id", memberId);
      // Only sync auth metadata when this client has a user session (not service role).
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id === memberId) {
          void supabase.auth.updateUser({ data: { profile_picture_url: source } });
        }
      } catch {
        // ignore — public/admin clients may not have a session
      }
    }
  }

  return resolveProfilePhotoUrl(supabase, source, options?.expiresInSeconds ?? 3600);
}
