"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";
import { startOAuthSignIn } from "@/lib/auth/start-oauth";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);

    try {
      const next = searchParams.get("next") || "/dashboard";
      await startOAuthSignIn(provider, next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "OAuth sign-in failed.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={className}
      >
        {loading ? "Redirecting…" : children}
      </button>
      {error ? <p className="text-center text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
