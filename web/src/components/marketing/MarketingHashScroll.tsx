"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Scroll to hash target after navigating to the home page (e.g. /#faq from /policies). */
export function MarketingHashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
