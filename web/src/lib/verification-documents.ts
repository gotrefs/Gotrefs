import { createServiceClient } from "@/lib/supabase/service";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

export async function createVerificationDocumentSignedUrl(
  storagePath: string | null | undefined
): Promise<string | null> {
  const path = storagePath?.trim();
  if (!path) return null;

  const admin = createServiceClient();
  const { data, error } = await admin.storage
    .from("verification_documents")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[verification-documents] signed URL failed:", error?.message ?? path);
    return null;
  }

  return data.signedUrl;
}
