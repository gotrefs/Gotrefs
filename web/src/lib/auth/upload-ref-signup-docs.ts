import { createClient } from "@/lib/supabase/client";

type RefSignupUploads = {
  govIdFront?: File | null;
  govIdBack?: File | null;
  certificationDocument?: File | null;
  profilePhoto?: File | null;
};

type RefSignupProfile = {
  primarySport: string;
  additionalSports?: string[];
  certificationLevel: string;
};

async function uploadVerificationFile(userId: string, file: File, prefix: string) {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  const safeExt = ext && ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext) ? ext : "jpg";
  const path = `${userId}/${prefix}_${Date.now()}.${safeExt}`;
  const contentType =
    file.type ||
    (safeExt === "pdf" ? "application/pdf" : `image/${safeExt === "jpg" ? "jpeg" : safeExt}`);
  const { error } = await supabase.storage
    .from("verification_documents")
    .upload(path, file, { upsert: true, contentType });
  if (error) throw error;
  return path;
}

/** Persist face photo to storage + members so the official ID card shows it immediately. */
export async function uploadRefProfilePhoto(userId: string, file: File): Promise<string> {
  const path = await uploadVerificationFile(userId, file, "profile_photo");
  const supabase = createClient();
  const { error: memberError } = await supabase
    .from("members")
    .update({ profile_picture_url: path })
    .eq("id", userId);
  if (memberError) throw memberError;

  await supabase.auth.updateUser({
    data: { profile_picture_url: path },
  });
  return path;
}

/** Upload referee ID / certification / profile files after signup while the session is active. */
export async function uploadRefSignupDocuments(
  userId: string,
  files: RefSignupUploads,
  profile?: RefSignupProfile
) {
  const [governmentIdFrontPath, governmentIdBackPath, certificationDocumentPath, profilePhotoPath] =
    await Promise.all([
      files.govIdFront
        ? uploadVerificationFile(userId, files.govIdFront, "gov_id_front")
        : Promise.resolve(null),
      files.govIdBack
        ? uploadVerificationFile(userId, files.govIdBack, "gov_id_back")
        : Promise.resolve(null),
      files.certificationDocument
        ? uploadVerificationFile(userId, files.certificationDocument, "certification")
        : Promise.resolve(null),
      files.profilePhoto
        ? uploadVerificationFile(userId, files.profilePhoto, "profile_photo")
        : Promise.resolve(null),
    ]);

  const supabase = createClient();
  const profilePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (governmentIdFrontPath) profilePatch.government_id_path = governmentIdFrontPath;
  if (governmentIdBackPath) profilePatch.verification_doc_path = governmentIdBackPath;
  if (certificationDocumentPath) profilePatch.certification_document_path = certificationDocumentPath;
  if (profile) {
    profilePatch.primary_sport = profile.primarySport;
    profilePatch.additional_sports = profile.additionalSports ?? [];
    profilePatch.certification_level = profile.certificationLevel;
  }

  if (Object.keys(profilePatch).length > 1) {
    const { error } = await supabase.from("ref_profiles").update(profilePatch).eq("member_id", userId);
    if (error) throw error;
  }

  if (profilePhotoPath) {
    const { error: memberError } = await supabase
      .from("members")
      .update({
        profile_picture_url: profilePhotoPath,
      })
      .eq("id", userId);
    if (memberError) throw memberError;

    // Keep auth metadata in sync so ID cards resolve even if members row lags.
    await supabase.auth.updateUser({
      data: { profile_picture_url: profilePhotoPath },
    });
  }

  return {
    governmentIdFrontPath,
    governmentIdBackPath,
    certificationDocumentPath,
    profilePhotoPath,
  };
}

/** Queue verification for admin review after signup uploads complete. */
export async function submitRefVerificationForReview() {
  const res = await fetch("/api/verification/submit", { method: "POST" });
  const json = (await res.json()) as { error?: string; status?: string };
  if (!res.ok) {
    throw new Error(json.error || "Could not submit verification for review.");
  }
  return json.status ?? "submitted";
}
