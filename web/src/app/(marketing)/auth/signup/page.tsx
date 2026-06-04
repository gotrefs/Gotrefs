import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center text-[var(--muted)]">Loading…</p>}>
      <SignupForm />
    </Suspense>
  );
}
