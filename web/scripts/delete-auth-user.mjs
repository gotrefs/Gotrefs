/**
 * Force-delete an auth user by email (frees the address for re-signup).
 *
 * Usage (from web/):
 *   node scripts/delete-auth-user.mjs you@example.com
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function findUserByEmail(admin, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/delete-auth-user.mjs you@example.com");
  process.exit(1);
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const projectRef = url.replace(/^https:\/\//, "").split(".")[0];
console.log(`Project: ${projectRef}`);
console.log(`Looking up: ${email}`);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const user = await findUserByEmail(admin, email);
if (!user) {
  console.log("No auth user found for that email in this project.");
  console.log("If signup still fails, gotrefs.org may be using a different Supabase project.");
  process.exit(0);
}

console.log(`Found user id: ${user.id}`);
console.log(`Providers: ${(user.app_metadata?.providers || []).join(", ") || "(none)"}`);
console.log(`Confirmed: ${Boolean(user.email_confirmed_at)}`);

const { error } = await admin.auth.admin.deleteUser(user.id);
if (error) {
  console.error("Delete failed:", error.message);
  process.exit(1);
}

const { error: memberErr } = await admin.from("members").delete().eq("id", user.id);
if (memberErr) {
  console.warn("Auth user deleted, but members cleanup warning:", memberErr.message);
} else {
  console.log("Deleted auth user + cleaned members row (if any).");
}

const stillThere = await findUserByEmail(admin, email);
console.log(stillThere ? "WARNING: user still listed after delete." : "Email is free to re-register.");
