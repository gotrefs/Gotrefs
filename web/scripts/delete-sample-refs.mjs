/**
 * Permanently delete every sample referee account created by seed-sample-refs.mjs.
 *
 * Only touches accounts where members.is_seed = true AND the email matches the
 * sample pattern, so a real ref can never be caught by mistake.
 *
 * Usage (from web/):
 *   node scripts/delete-sample-refs.mjs            # list what would be deleted
 *   node scripts/delete-sample-refs.mjs --confirm  # delete them
 *
 * SQL equivalent (Supabase SQL editor):
 *   delete from auth.users where id in (select id from public.members where is_seed);
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_EMAIL_PREFIX = "gotrefs-sample-";
const SEED_EMAIL_DOMAIN = "example.com";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = value;
  }
  return env;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const env = { ...loadEnvLocal(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: seeds, error } = await admin
    .from("members")
    .select("id, display_name, seed_batch")
    .eq("is_seed", true);
  if (error) throw error;

  const targets = [];
  for (const m of seeds ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.id);
    const email = data?.user?.email ?? "";
    if (email.startsWith(SEED_EMAIL_PREFIX) && email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
      targets.push({ ...m, email });
    } else {
      console.warn(`Skipping ${m.id} (${m.display_name}): flagged is_seed but email "${email}" is not a sample address.`);
    }
  }

  console.log(`${targets.length} sample refs found.`);
  if (!confirm) {
    console.log("Nothing deleted. Re-run with --confirm to delete them.");
    return;
  }

  let deleted = 0;
  for (const t of targets) {
    const { error: delErr } = await admin.auth.admin.deleteUser(t.id);
    if (delErr) console.error(`  ${t.email}: ${delErr.message}`);
    else deleted++;
  }
  console.log(`Deleted ${deleted} of ${targets.length} sample refs.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
