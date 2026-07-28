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

export type RefEligibilityArgs = {
  screeningStatus?: string | null;
  verificationMethod?: string | null;
  externalProofPath?: string | null;
  verificationSubmissionStatus?: string | null;
  profile?: RefProfileForEligibility;
};

export function refVerificationDocsComplete(profile: RefProfileForEligibility): boolean {
  if (!profile) return false;
  const hasId = Boolean(profile.government_id_path || profile.verification_doc_path);
  const hasCert = Boolean(profile.certification_document_path);
  const hasSport = Boolean(profile.primary_sport?.trim());
  const hasCertLevel = Boolean(profile.certification_level?.trim());
  return hasId && hasCert && hasSport && hasCertLevel;
}

export function refProfilePackageComplete(profile: RefProfileForEligibility): boolean {
  if (!profile) return false;
  const hasProfile = Boolean(
    profile.bio?.trim() && profile.primary_sport?.trim() && profile.certification_level?.trim()
  );
  return refVerificationDocsComplete(profile) && hasProfile;
}

export function refVerificationPendingReview(status?: string | null): boolean {
  return ["submitted", "under_review"].includes(status ?? "");
}

export function refVerificationApproved(status?: string | null): boolean {
  return status === "approved";
}

export function refVerificationRejected(status?: string | null): boolean {
  return status === "rejected";
}

/** Refs can request to work games only after admin approval (or equivalent verified path). */
export function refCanApplyToGames(args: RefEligibilityArgs): boolean {
  return refOfferEligible(args);
}

export function refOfferEligible(args: RefEligibilityArgs): boolean {
  const status = args.verificationSubmissionStatus ?? null;

  // Explicit admin reject / revoke always blocks — even if screening was previously "clear".
  if (refVerificationRejected(status)) return false;
  // Needs info / awaiting review: not eligible to apply until re-approved.
  if (refVerificationPendingReview(status)) return false;
  // Any open fix list means approval is paused (defensive if status lagged).
  // Callers that know fix steps should pass pending/under_review status; this keeps apply locked.

  if (args.verificationMethod === "external" && args.externalProofPath) {
    // External proof only counts when admin has not moved them into a pending/rejected cycle.
    if (!status || status === "approved" || status === "draft" || status === "not_submitted") {
      return true;
    }
    return false;
  }

  if (refVerificationApproved(status)) return true;

  // Legacy path: clear screening only when there is no verification decision yet.
  if (args.screeningStatus === "clear" && (!status || status === "draft" || status === "not_submitted")) {
    return true;
  }

  return false;
}
