/** Mask email for display — never expose full address to organizers in UI. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "•••@•••.•••";

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot + 1) : "com";

  const maskedLocal = local.length <= 1 ? "•" : `${local[0]}•••`;
  const maskedDomain = domainName.length <= 1 ? "•••" : `${domainName[0]}•••`;
  return `${maskedLocal}@${maskedDomain}.${tld}`;
}
