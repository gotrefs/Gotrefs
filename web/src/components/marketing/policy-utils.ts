import { POLICY_DOCUMENTS, type PolicyDocument } from "@/data/policies";

export const MARKETING_POLICIES = POLICY_DOCUMENTS;

export function policyShortLabel(policy: PolicyDocument) {
  switch (policy.slug) {
    case "privacy-policy":
      return "Privacy Policy";
    case "payment-fee-policy":
      return "Payment & Fee Policy";
    case "event-organizer-terms":
      return "Event Organizer Terms";
    case "referee-official-terms":
      return "Referee & Official Terms";
    case "background-check-verification":
      return "Background Check & Verification";
    case "community-standards":
      return "Community Standards";
    case "verified-program":
      return "Verified Program";
    default:
      return policy.title;
  }
}
