/** Shared rules for when a ref can receive or accept assignment offers and apply to events. */

export type RefProfileForEligibility = {
  government_id_path?: string | null;
  verification_doc_path?: string | null;
  certification_document_path?: string | null;
  bio?: string | null;
  primary_sport?: string | null;
  certification_level?: string | null;
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

const TRUSTED_SCREENING_PROVIDERS = new Set(["checkr", "nsid"]);

export function refOfferEligible(args: {
  screeningStatus?: string | null;
  screeningProvider?: string | null;
  verificationSubmissionStatus?: string | null;
}): boolean {
  if (args.verificationSubmissionStatus === "approved") return true;

  if (
    args.screeningStatus === "clear" &&
    args.screeningProvider &&
    TRUSTED_SCREENING_PROVIDERS.has(args.screeningProvider)
  ) {
    return true;
  }

  return false;
}

export function refCanApplyToEvents(verificationSubmissionStatus?: string | null): boolean {
  return verificationSubmissionStatus === "approved";
}
