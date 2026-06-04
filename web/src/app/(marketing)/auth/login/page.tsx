import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center text-[var(--muted)]">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
