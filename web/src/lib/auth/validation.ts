const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e) return "Email is required.";
  if (!EMAIL_RE.test(e)) return "Enter a valid email address.";
  if (e.length > 254) return "Email is too long.";
  return null;
}

export function validateName(name: string, label: string): string | null {
  const n = name.trim();
  if (!n) return `${label} is required.`;
  if (n.length > 100) return `${label} is too long.`;
  return null;
}
