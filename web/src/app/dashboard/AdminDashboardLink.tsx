import Link from "next/link";
import { isGotrefsAdminUser } from "@/lib/auth/admin-access";
import { createClient } from "@/lib/supabase/server";

export async function AdminDashboardLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isGotrefsAdminUser(user)) {
    return null;
  }

  return (
    <Link
      href="/dashboard/admin"
      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-bold text-[var(--navy)] hover:border-[var(--navy)]"
    >
      Admin
    </Link>
  );
}
