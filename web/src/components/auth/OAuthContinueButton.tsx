"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";

type OAuthContinueButtonProps = {
  provider: OAuthProvider;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

/** OAuth must not live inside another <form> — nested forms are invalid HTML and break the button. */
export function OAuthContinueButton({
  provider,
  className,
  children,
  disabled = false,
}: OAuthContinueButtonProps) {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled || pending}
      className={`${className ?? ""}${disabled || pending ? " pointer-events-none opacity-60" : ""}`}
      onClick={() => {
        setPending(true);
        const params = new URLSearchParams({ next });
        window.location.assign(`/api/auth/oauth/${provider}?${params.toString()}`);
      }}
    >
      {pending ? "Redirecting…" : children}
    </button>
  );
}
