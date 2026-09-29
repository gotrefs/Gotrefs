import "server-only";
import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Issue a new GoTRefs ID (GR-######) that no other ref has.
 * Checks the database so two refs can never share an ID.
 */
export async function issueUniqueGotrefsId(admin: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = `GR-${randomInt(100000, 1000000)}`;
    const { data, error } = await admin
      .from("ref_profiles")
      .select("member_id")
      .ilike("gotrefs_id", candidate)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return candidate;
  }
  throw new Error("Could not issue a GoTRefs ID. Try again.");
}
