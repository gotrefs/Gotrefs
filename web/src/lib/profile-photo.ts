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
