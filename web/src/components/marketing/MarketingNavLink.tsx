"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  queueHomeSectionScroll,
  scrollToHomeSectionWhenReady,
} from "@/lib/marketing-scroll";

type MarketingNavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Home section anchors use /#id so they work from any page; smooth-scroll when already on /. */
export function MarketingNavLink({ href, children, className }: MarketingNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isHomeAnchor = href.startsWith("#");
  const targetId = isHomeAnchor ? href.slice(1) : null;

  if (!isHomeAnchor || !targetId) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={`/#${targetId}`}
      className={className}
      onClick={(event) => {
        event.preventDefault();

        if (pathname === "/") {
          scrollToHomeSectionWhenReady(targetId);
          return;
        }

        queueHomeSectionScroll(targetId);
        router.push(`/#${targetId}`);
      }}
    >
      {children}
    </a>
  );
}
