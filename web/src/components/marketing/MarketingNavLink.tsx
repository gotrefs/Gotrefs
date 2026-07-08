"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { scrollToMarketingSection, scrollToMarketingSectionWhenReady } from "./marketing-scroll";

type MarketingNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function MarketingNavLink({ href, children, className }: MarketingNavLinkProps) {
  const pathname = usePathname();
  const isHashLink = href.startsWith("#");
  const sectionId = isHashLink ? href.slice(1) : null;
  const linkHref = isHashLink ? `/${href}` : href;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!sectionId) return;

    if (pathname === "/") {
      event.preventDefault();
      scrollToMarketingSectionWhenReady(sectionId);
      window.history.pushState(null, "", href);
      return;
    }

    // Let Next.js navigate to /#section; HashScrollOnLoad handles scroll after paint.
    sessionStorage.setItem("marketing-scroll-target", sectionId);
  }

  return (
    <Link href={linkHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
