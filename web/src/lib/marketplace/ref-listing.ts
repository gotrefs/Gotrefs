/**
 * When a real REF shows up on Find REFS before GotREFS has verified them:
 * they need a photo, a first and last name, a sport and a phone number on file.
 * (Email always exists: it is how they log in.) The phone is only checked here,
 * never shown to organizers.
 */
export function refHasListingBasics(args: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  photo?: string | null;
  sport?: string | null;
  phone?: string | null;
}): boolean {
  const first = (args.firstName ?? "").trim();
  const last = (args.lastName ?? "").trim();
  const nameParts = (args.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const hasName = Boolean(first && last) || nameParts.length >= 2;
  const hasPhoto = Boolean((args.photo ?? "").trim());
  const hasSport = Boolean((args.sport ?? "").trim());
  const hasPhone = (args.phone ?? "").replace(/\D/g, "").length >= 10;
  return hasName && hasPhoto && hasSport && hasPhone;
}
