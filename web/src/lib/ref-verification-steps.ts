/** Signup / verification steps shared between admin review and ref resubmit flow. */

export type RefVerificationStepKey = "profile" | "sports" | "government_id" | "certification" | "location";

export const REF_VERIFICATION_STEPS: {
  number: number;
  key: RefVerificationStepKey;
  label: string;
  shortLabel: string;
}[] = [
  { number: 1, key: "profile", label: "Profile & photo", shortLabel: "Profile photo" },
  { number: 2, key: "sports", label: "Sports & certification level", shortLabel: "Sports" },
  { number: 3, key: "government_id", label: "Government ID (front & back)", shortLabel: "ID pictures" },
  { number: 4, key: "certification", label: "Certification / license document", shortLabel: "Verification documents" },
  { number: 5, key: "location", label: "Location & travel range", shortLabel: "Location" },
];

const STEP_KEYS = new Set(REF_VERIFICATION_STEPS.map((step) => step.key));

export function isRefVerificationStepKey(value: string): value is RefVerificationStepKey {
  return STEP_KEYS.has(value as RefVerificationStepKey);
}

export function normalizeFixRequiredSteps(values: unknown): RefVerificationStepKey[] {
  if (!Array.isArray(values)) return [];
  const ordered: RefVerificationStepKey[] = [];
  for (const step of REF_VERIFICATION_STEPS) {
    if (values.includes(step.key)) ordered.push(step.key);
  }
  return ordered;
}

export function stepLabelForKey(key: RefVerificationStepKey): string {
  return REF_VERIFICATION_STEPS.find((step) => step.key === key)?.label ?? key;
}
