"use client";

import { useEffect, useState } from "react";

export function StickyMarketplaceSearch({
  children,
  topOffsetClass = "top-14",
}: {
  children: React.ReactNode;
  topOffsetClass?: string;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 96);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky z-30 -mx-1 transition-all duration-300 ${topOffsetClass} ${
        compact
          ? "rounded-full border border-neutral-200 bg-white/95 py-1 shadow-[0_6px_20px_rgba(0,0,0,0.12)] backdrop-blur-md"
          : "bg-transparent py-0"
      }`}
    >
      {children}
    </div>
  );
}
