/** Shared validity helpers — safe for server and client. */

export function cardValidThrough(reviewedAtIso: string | null | undefined): Date | null {
  if (!reviewedAtIso) return null;
  const start = new Date(reviewedAtIso);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end;
}

export function formatCardValidThrough(reviewedAtIso: string | null | undefined): string | null {
  const end = cardValidThrough(reviewedAtIso);
  if (!end) return null;
  return end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
