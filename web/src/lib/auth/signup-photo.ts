import type { SupabaseClient } from "@supabase/supabase-js";

/** Largest photo accepted with a signup request (the form shrinks photos well below this). */
export const MAX_SIGNUP_PHOTO_BYTES = 1_500_000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function looksLikeImage(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (contentType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

/** Parse a `data:image/...;base64,` photo sent with signup. Null when it isn't a small, real image. */
export function decodeSignupPhoto(
  dataUrl: unknown
): { bytes: Buffer; contentType: string; ext: string } | null {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_SIGNUP_PHOTO_BYTES * 1.4) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 100 || bytes.length > MAX_SIGNUP_PHOTO_BYTES) return null;
  if (!looksLikeImage(bytes, contentType)) return null;
  return { bytes, contentType, ext: EXT_BY_TYPE[contentType] };
}

/**
 * Save the photo a ref picked at signup, using the service client so it works before
 * the ref has confirmed their email (and on whatever device they confirm from).
 * Returns false when there was no usable photo or storage refused it.
 */
export async function saveSignupProfilePhoto(
  admin: SupabaseClient,
  userId: string,
  dataUrl: unknown
): Promise<boolean> {
  const photo = decodeSignupPhoto(dataUrl);
  if (!photo) return false;
  const path = `${userId}/profile_photo_${Date.now()}.${photo.ext}`;
  const { error } = await admin.storage
    .from("verification_documents")
    .upload(path, photo.bytes, { contentType: photo.contentType, upsert: true });
  if (error) {
    console.warn("[signup-photo] upload failed:", error.message);
    return false;
  }
  // The card also finds profile_photo_* files in the member's folder, so a failed row update is not fatal.
  const { error: rowError } = await admin.from("members").update({ profile_picture_url: path }).eq("id", userId);
  if (rowError) console.warn("[signup-photo] members update failed:", rowError.message);
  return true;
}
