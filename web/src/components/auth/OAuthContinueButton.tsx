"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithOAuthAction } from "@/lib/auth/oauth-actions";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";

type OAuthContinueButtonProps = {
  provider: OAuthProvider;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export function OAuthContinueButton({
  provider,
  className,
  children,
  disabled = false,
}: OAuthContinueButtonProps) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const next = searchParams.get("next") || "/dashboard";
        await signInWithOAuthAction(provider, next);
      } catch (err) {
        const message = err instanceof Error ? err.message : "OAuth sign-in failed.";
        if (!message.includes("NEXT_REDIRECT")) {
          setError(message);
        }
      }
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className={className}
      >
        {pending ? "Redirecting…" : children}
      </button>
      {error ? <p className="text-center text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
