"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";

type OAuthContinueButtonProps = {
  provider: OAuthProvider;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

/** Full-page navigation so PKCE cookies are set reliably by the OAuth API route. */
export function OAuthContinueButton({
  provider,
  className,
  children,
  disabled = false,
}: OAuthContinueButtonProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const href = `/api/auth/oauth/${provider}?next=${encodeURIComponent(next)}`;

  return (
    <Link href={href} className={`${className}${disabled ? " pointer-events-none opacity-60" : ""}`}>
      {children}
    </Link>
  );
}
