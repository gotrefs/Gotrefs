"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPendingHomeSectionId, scrollToHomeSectionWhenReady } from "@/lib/marketing-scroll";

/** Scroll to hash target after navigating to the home page (e.g. /#faq from /policies). */
export function MarketingHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const scrollToTarget = () => {
      const sectionId = getPendingHomeSectionId();
      if (sectionId) scrollToHomeSectionWhenReady(sectionId);
    };

    scrollToTarget();

    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "").trim();
      if (hash) scrollToHomeSectionWhenReady(hash);
    };

    window.addEventListener("hashchange", onHashChange);

    // Production builds hydrate slower than local dev — retry after paint.
    const retryTimers = [100, 300, 700].map((delay) => window.setTimeout(scrollToTarget, delay));

    return () => {
      window.removeEventListener("hashchange", onHashChange);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
