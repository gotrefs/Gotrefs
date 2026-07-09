import { createClient } from "@/lib/supabase/client";

type RefSignupUploads = {
  govIdFront: File;
  govIdBack: File;
  certificationDocument: File;
};

type RefSignupProfile = {
  primarySport: string;
  additionalSports?: string[];
  certificationLevel: string;
};

async function uploadVerificationFile(userId: string, file: File, prefix: string) {
  const supabase = createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `${userId}/${prefix}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("verification_documents").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** Upload referee ID and certification files after signup while the session is active. */
export async function uploadRefSignupDocuments(
  userId: string,
  files: RefSignupUploads,
  profile?: RefSignupProfile
) {
  const [governmentIdFrontPath, governmentIdBackPath, certificationDocumentPath] = await Promise.all([
    uploadVerificationFile(userId, files.govIdFront, "gov_id_front"),
    uploadVerificationFile(userId, files.govIdBack, "gov_id_back"),
    uploadVerificationFile(userId, files.certificationDocument, "certification"),
  ]);

  const supabase = createClient();
  const { error } = await supabase
    .from("ref_profiles")
    .update({
      government_id_path: governmentIdFrontPath,
      verification_doc_path: governmentIdBackPath,
      certification_document_path: certificationDocumentPath,
      ...(profile
        ? {
            primary_sport: profile.primarySport,
            additional_sports: profile.additionalSports ?? [],
            certification_level: profile.certificationLevel,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", userId);

  if (error) throw error;
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
