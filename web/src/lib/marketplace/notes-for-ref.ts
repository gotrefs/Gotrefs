/** Shared helpers so refs never see organizer email/phone in event notes. */

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g;
const STANDALONE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const STANDALONE_PHONE_RE = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}$/;

export const ORGANIZER_CONTACT_IN_NOTES_MESSAGE =
  "Don't include your email or phone number in notes for refs. Contact stays private — GotREFS handles communication after a booking is confirmed.";

export function textContainsOrganizerContact(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  EMAIL_RE.lastIndex = 0;
  PHONE_RE.lastIndex = 0;
  if (EMAIL_RE.test(value)) return true;
  // Require enough digits to look like a real phone (avoids gate codes like "1234").
  const digitCount = (value.match(/\d/g) ?? []).length;
  if (digitCount < 10) return false;
  PHONE_RE.lastIndex = 0;
  return PHONE_RE.test(value);
}

function stripEmailsAndPhones(text: string): string {
  return text
    .replace(EMAIL_RE, "")
    .replace(PHONE_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:·-]+|[\s,;:·-]+$/g, "")
    .trim();
}

function cleanPart(part: string): string {
  if (/^contact:/i.test(part)) return "";
  if (STANDALONE_EMAIL_RE.test(part)) return "";
  if (STANDALONE_PHONE_RE.test(part.replace(/\s/g, ""))) return "";
  return stripEmailsAndPhones(part);
}

/**
 * What refs should see: only “notes for refs” content when present,
 * never Level/Club/Contact dumps, emails, or phone numbers.
 */
export function notesForRefDisplay(notes: string | null | undefined): string {
  if (!notes?.trim()) return "";

  const parts = notes
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const fromLabeled = parts
    .filter((part) => /^notes for refs:/i.test(part))
    .map((part) => part.replace(/^notes for refs:\s*/i, "").trim())
    .map(cleanPart)
    .filter(Boolean);

  if (fromLabeled.length > 0) {
    return fromLabeled.join(" ");
  }

  return parts
    .filter((part) => !/^level:/i.test(part))
    .filter((part) => !/^club:/i.test(part))
    .filter((part) => !/^contact:/i.test(part))
    .map(cleanPart)
    .filter(Boolean)
    .join(" · ");
}

/** Persist only ref-facing instructions; strip contact if present. */
export function sanitizeNotesForStorage(notes: string | null | undefined): string | null {
  const cleaned = notesForRefDisplay(notes);
  return cleaned || null;
}
