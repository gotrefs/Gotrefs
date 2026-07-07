export const MARKETING_PENDING_SCROLL_KEY = "gotrefs:marketing-scroll";

const HEADER_OFFSET_PX = 68;

/** Scroll to a home-page section, retrying until the target mounts (needed on Vercel after client nav). */
export function scrollToHomeSection(sectionId: string, behavior: ScrollBehavior = "smooth"): boolean {
  const target = document.getElementById(sectionId);
  if (!target) return false;

  const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;
  window.scrollTo({ top: Math.max(0, top), behavior });

  const nextHash = `#${sectionId}`;
  if (window.location.pathname === "/" && window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }

  sessionStorage.removeItem(MARKETING_PENDING_SCROLL_KEY);

  return true;
}

export function scrollToHomeSectionWhenReady(
  sectionId: string,
  behavior: ScrollBehavior = "smooth",
  maxAttempts = 40,
  intervalMs = 50
): void {
  let attempts = 0;

  const tryScroll = () => {
    if (scrollToHomeSection(sectionId, behavior)) return;
    attempts += 1;
    if (attempts < maxAttempts) {
      window.setTimeout(tryScroll, intervalMs);
    }
  };

  tryScroll();
}

export function getPendingHomeSectionId(): string | null {
  if (typeof window === "undefined") return null;

  const pending = sessionStorage.getItem(MARKETING_PENDING_SCROLL_KEY);
  if (pending) return pending;

  const hash = window.location.hash.replace(/^#/, "").trim();
  return hash || null;
}

export function queueHomeSectionScroll(sectionId: string): void {
  sessionStorage.setItem(MARKETING_PENDING_SCROLL_KEY, sectionId);
}
