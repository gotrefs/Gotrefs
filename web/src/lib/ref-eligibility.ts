/** Shared rules for when a ref can receive or accept assignment offers. */

export type RefProfileForEligibility = {
  government_id_path?: string | null;
  verification_doc_path?: string | null;
  certification_document_path?: string | null;
  bio?: string | null;
  primary_sport?: string | null;
  certification_level?: string | null;
  verification_method?: string | null;
  external_verification_proof_path?: string | null;
} | null;

export function refProfilePackageComplete(profile: RefProfileForEligibility): boolean {
  if (!profile) return false;
  const hasId = Boolean(profile.government_id_path || profile.verification_doc_path);
  const hasCert = Boolean(profile.certification_document_path);
  const hasProfile = Boolean(
    profile.bio?.trim() && profile.primary_sport?.trim() && profile.certification_level?.trim()
  );
  return hasId && hasCert && hasProfile;
}

export function refOfferEligible(args: {
  screeningStatus?: string | null;
  verificationMethod?: string | null;
  externalProofPath?: string | null;
  verificationSubmissionStatus?: string | null;
  profile?: RefProfileForEligibility;
}): boolean {
  if (args.screeningStatus === "clear") return true;

  if (args.verificationMethod === "external" && args.externalProofPath) return true;

  const submission = args.verificationSubmissionStatus ?? "";
  if (["submitted", "under_review", "approved"].includes(submission)) return true;

  return refProfilePackageComplete(args.profile ?? null);
}
