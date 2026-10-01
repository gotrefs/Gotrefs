"use client";

import { useTransition } from "react";
import { signInWithOAuthAction } from "@/lib/auth/oauth-actions";
import type { OAuthProvider } from "@/lib/auth/oauth-providers";

const LABELS: Record<"google" | "apple", string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M16.37 12.64c-.02-2.3 1.88-3.41 1.97-3.46-1.07-1.57-2.74-1.79-3.33-1.81-1.42-.14-2.77.84-3.49.84-.72 0-1.83-.82-3.01-.8-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.45-3.7zM14.08 5.87c.64-.78 1.07-1.85.95-2.93-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.78-.97 2.83 1.03.08 2.07-.52 2.71-1.28z" />
    </svg>
  );
}

/** Google / Apple buttons that bring a new ref back to the one-screen finish step. */
export function JoinProviderButtons({
  enabled,
}: {
  enabled: Record<"google" | "apple", boolean>;
}) {
  const [pending, startTransition] = useTransition();

  const start = (provider: OAuthProvider) =>
    startTransition(() => {
      void signInWithOAuthAction(provider, "/join/finish");
    });

  return (
    <div className="space-y-3">
      {(["google", "apple"] as const)
        // Google always shows (as "coming soon" until switched on); Apple only once it's enabled.
        .filter((provider) => provider === "google" || enabled[provider])
        .map((provider) => {
          const on = enabled[provider];
          return (
            <button
              key={provider}
              type="button"
              disabled={!on || pending}
              onClick={() => start(provider)}
              className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                provider === "apple"
                  ? "border-black bg-black text-white hover:bg-neutral-800"
                  : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              {provider === "google" ? <GoogleMark /> : <AppleMark />}
              {pending ? "Redirecting…" : LABELS[provider]}
              {!on && (
                <span className="text-xs font-medium opacity-80">
                  (coming soon)
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
}
