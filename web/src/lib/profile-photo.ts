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

  const { data, error } = await supabase.storage
    .from("verification_documents")
    .createSignedUrl(value, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
