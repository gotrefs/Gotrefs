"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type MarketingNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Home section anchors use /#id so they work from any page; smooth-scroll when already on /. */
export function MarketingNavLink({ href, children, className }: MarketingNavLinkProps) {
  const pathname = usePathname();
  const isHomeAnchor = href.startsWith("#");
  const targetId = isHomeAnchor ? href.slice(1) : null;
  const linkHref = isHomeAnchor ? `/${href}` : href;

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!targetId || pathname !== "/") return;

    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", `#${targetId}`);
  }

  return (
    <Link href={linkHref} className={className} onClick={handleClick} scroll={!isHomeAnchor}>
      {children}
    </Link>
  );
}
