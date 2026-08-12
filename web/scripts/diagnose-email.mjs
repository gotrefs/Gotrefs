import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of text.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const email = (process.argv[2] || "michaelraich1@gmail.com").trim().toLowerCase();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUser(email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

console.log("Project:", url);
console.log("Email:", email);

let user = await findUser(email);
console.log("Admin listUsers find:", user ? { id: user.id, confirmed: !!user.email_confirmed_at, identities: user.identities?.map((i) => i.provider) } : null);

// Probe signUp the way the app does (this is what often returns a fake "existing" user)
const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
  email,
  password: "TempProbePass1!",
  options: { data: { probe: true } },
});
console.log("signUp error:", signUpError?.message || null);
console.log("signUp user id:", signUpData.user?.id || null);
console.log("signUp identities:", signUpData.user?.identities?.map((i) => i.provider) || null);
console.log("signUp session?", Boolean(signUpData.session));

if (signUpData.user && (!signUpData.user.identities || signUpData.user.identities.length === 0) && !signUpData.session) {
  console.log("DIAGNOSIS: Supabase treated this email as ALREADY REGISTERED (empty identities + no session).");
}

// Clean up if we accidentally created a real probe user
user = await findUser(email);
if (user) {
  console.log("Cleaning up auth user", user.id);
  const { data: files } = await admin.storage.from("verification_documents").list(user.id, { limit: 100 });
  if (files?.length) {
    await admin.storage.from("verification_documents").remove(files.map((f) => `${user.id}/${f.name}`));
  }
  await admin.from("members").delete().eq("id", user.id);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  console.log(delErr ? `Delete failed: ${delErr.message}` : "Deleted probe/leftover user.");
} else {
  console.log("No auth user present after probe.");
}
