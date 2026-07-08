/** Sticky marketing header height — keep in sync with scroll-mt on sections. */
export const MARKETING_HEADER_OFFSET_PX = 68;

export function scrollToMarketingSection(id: string, behavior: ScrollBehavior = "smooth") {
  const el = document.getElementById(id);
  if (!el) return false;

  el.scrollIntoView({ behavior, block: "start" });
  return true;
}

/** Retry scroll until the target section is in the DOM (post-navigation). */
export function scrollToMarketingSectionWhenReady(
  id: string,
  behavior: ScrollBehavior = "smooth",
  maxAttempts = 12,
) {
  let attempts = 0;

  const tryScroll = () => {
    if (scrollToMarketingSection(id, behavior)) return;
    attempts += 1;
    if (attempts < maxAttempts) {
      window.setTimeout(tryScroll, 50);
    }
  };

  tryScroll();
}
