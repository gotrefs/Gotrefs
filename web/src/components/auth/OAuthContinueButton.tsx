"use client";

import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { signInWithOAuthAction } from "@/lib/auth/oauth-actions";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";

type OAuthContinueButtonProps = {
  provider: OAuthProvider;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

function OAuthSubmitButton({
  className,
  children,
  disabled,
}: {
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={`${className}${disabled || pending ? " pointer-events-none opacity-60" : ""}`}
    >
      {pending ? "Redirecting…" : children}
    </button>
  );
}

/** Server action starts OAuth so PKCE verifier cookies are set before leaving the site. */
export function OAuthContinueButton({
  provider,
  className,
  children,
  disabled = false,
}: OAuthContinueButtonProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const startOAuth = signInWithOAuthAction.bind(null, provider, next);

  return (
    <form action={startOAuth}>
      <OAuthSubmitButton className={className} disabled={disabled}>
        {children}
      </OAuthSubmitButton>
    </form>
  );
}
