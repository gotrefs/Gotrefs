"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scrollToMarketingSectionWhenReady } from "./marketing-scroll";

/** Scrolls to a homepage section after navigation (hash URL or nav from another page). */
export function HashScrollOnLoad() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const targetId = sessionStorage.getItem("marketing-scroll-target");
    if (targetId) {
      sessionStorage.removeItem("marketing-scroll-target");
      scrollToMarketingSectionWhenReady(targetId);
      return;
    }

    const hash = window.location.hash.slice(1);
    if (hash) {
      scrollToMarketingSectionWhenReady(hash);
    }
  }, [pathname]);

  return null;
}
