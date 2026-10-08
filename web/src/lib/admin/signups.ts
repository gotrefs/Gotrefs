import type { SupabaseClient, User } from "@supabase/supabase-js";

/** One account on the admin "Signups" list. */
export type AdminSignupEntry = {
  id: string;
  role: "ref" | "organizer" | "unknown";
  firstName: string;
  lastName: string;
  /** Best available full name; empty when the account has none on file. */
  name: string;
  email: string;
  phone: string;
  /** Organizers: organization name. */
  organization: string;
  /** Refs: primary sport. */
  sport: string;
  /** Refs: GoTRefs ID. */
  gotrefsId: string;
  signedUpAt: string | null;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
};

type MemberRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  organization_name?: string | null;
  is_seed?: boolean | null;
};

type ProfileRow = { member_id: string; primary_sport?: string | null; gotrefs_id?: string | null };

const SAMPLE_EMAIL = /^gotrefs-sample-.*@example\.com$/i;
const MAX_AUTH_PAGES = 20;
const AUTH_PAGE_SIZE = 1000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Every auth account, newest pages included. Auth is the source of truth for "who signed up". */
async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= MAX_AUTH_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error) throw new Error(error.message);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < AUTH_PAGE_SIZE) break;
  }
  return users;
}

/**
 * Select rows, dropping any column this database doesn't have yet (older schema)
 * and retrying, so a missing optional column never empties the list.
 */
async function selectTolerant<T>(
  admin: SupabaseClient,
  table: string,
  required: string[],
  optional: string[]
): Promise<T[]> {
  let columns = [...required, ...optional];
  for (let attempt = 0; attempt <= optional.length; attempt++) {
    const rows: T[] = [];
    let failed: { code?: string; message?: string } | null = null;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(table).select(columns.join(", ")).range(from, from + 999);
      if (error) {
        failed = error;
        break;
      }
      const batch = (data as T[] | null) ?? [];
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (!failed) return rows;
    const missing = columns.find((column) => !required.includes(column) && failed?.message?.includes(column));
    if (!missing) {
      console.error(`[admin-signups] ${table}:`, failed.message);
      return [];
    }
    columns = columns.filter((column) => column !== missing);
  }
  return [];
}

/**
 * Every real account (refs and organizers), newest first. Sample refs are left out, and so is
 * anyone deleted in Supabase (from Authentication → Users, or from the members table).
 */
export async function loadAllSignups(admin: SupabaseClient): Promise<AdminSignupEntry[]> {
  const [users, members, profiles] = await Promise.all([
    listAllAuthUsers(admin),
    selectTolerant<MemberRow>(admin, "members", ["id"], [
      "role",
      "display_name",
      "first_name",
      "last_name",
      "email",
      "phone",
      "organization_name",
      "is_seed",
    ]),
    selectTolerant<ProfileRow>(admin, "ref_profiles", ["member_id"], ["primary_sport", "gotrefs_id"]),
  ]);

  const memberById = new Map(members.map((row) => [row.id, row]));
  const profileById = new Map(profiles.map((row) => [row.member_id, row]));

  // Signup always creates a members row, so a login with none left means the person was
  // deleted from the members table in Supabase: leave them off. (Skipped if members could
  // not be read at all, so a failed query never empties the list.)
  const membersReadable = members.length > 0;

  const entries: AdminSignupEntry[] = [];
  for (const user of users) {
    const member = memberById.get(user.id);
    if (membersReadable && !member) continue;
    const email = text(user.email) || text(member?.email);
    if (member?.is_seed === true || SAMPLE_EMAIL.test(email)) continue;

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const profile = profileById.get(user.id);
    const fullFromMeta = text(meta.full_name) || text(meta.name);
    const firstName = text(member?.first_name) || text(meta.first_name) || fullFromMeta.split(/\s+/)[0] || "";
    const lastName =
      text(member?.last_name) ||
      text(meta.last_name) ||
      (fullFromMeta.includes(" ") ? fullFromMeta.split(/\s+/).slice(1).join(" ") : "");
    const name = [firstName, lastName].filter(Boolean).join(" ") || text(member?.display_name) || fullFromMeta;

    const rawRole = text(member?.role) || text(meta.role);
    const role = rawRole === "ref" || rawRole === "organizer" ? rawRole : "unknown";

    entries.push({
      id: user.id,
      role,
      firstName,
      lastName,
      name,
      email,
      phone: text(member?.phone) || text(meta.phone) || text(user.phone),
      organization: text(member?.organization_name) || text(meta.organization_name),
      sport: role === "ref" ? text(profile?.primary_sport) || text(meta.primary_sport) : "",
      gotrefsId: role === "ref" ? text(profile?.gotrefs_id) || text(meta.gotrefs_id) : "",
      signedUpAt: user.created_at ?? null,
      emailConfirmed: Boolean(user.email_confirmed_at),
      lastSignInAt: user.last_sign_in_at ?? null,
    });
  }

  entries.sort((a, b) => (b.signedUpAt ?? "").localeCompare(a.signedUpAt ?? ""));
  return entries;
}
