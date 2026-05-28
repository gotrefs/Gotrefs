"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="text-sm text-[var(--muted)] underline"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
