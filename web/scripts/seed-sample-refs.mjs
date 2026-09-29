/**
 * Create sample referee accounts so the marketplace, map and ID cards can be
 * seen with realistic volume before real refs join.
 *
 * Every account created here is flagged members.is_seed = true and tagged with
 * members.seed_batch, is never bookable (see ref_is_offer_eligible), and shows
 * "Sample profile" on its request button. Emails use the reserved example.com
 * domain, so nothing is ever sent to a real inbox.
 *
 * Usage (from web/, needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local):
 *   node scripts/seed-sample-refs.mjs --dry-run     # print what would be created
 *   node scripts/seed-sample-refs.mjs               # create 200 sample refs
 *   node scripts/seed-sample-refs.mjs --count 50    # create a different number
 *
 * Safe to re-run: existing sample accounts (same email) are updated, not duplicated.
 * Remove them all with: node scripts/delete-sample-refs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SEED_BATCH = "sample-2026-09";
export const SEED_EMAIL_PREFIX = "gotrefs-sample-";
export const SEED_EMAIL_DOMAIN = "example.com";

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

// Deterministic random numbers so every run produces the same 200 refs.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260929);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => Math.round(min + rand() * (max - min));

// First names grouped so each name suits the face it's paired with.
const MALE_NAMES = [
  "Marcus", "Diego", "Kevin", "Andre", "Tyler", "Luis", "Darnell", "Brandon", "Omar", "Anthony",
  "Javier", "Ryan", "Terrence", "Carlos", "Eric", "Malik", "Victor", "Jason", "Derek", "Miguel",
  "Chris", "Andrew", "Isaiah", "Daniel", "Ricardo", "Jamal", "Ethan", "Xavier", "Hector", "Adrian",
  "Julian", "Mateo", "Dominic", "Andres", "Marco", "Elijah", "Nathan", "Rafael", "Kendrick", "Sergio",
];
const FEMALE_NAMES = [
  "Jasmine", "Aaliyah", "Sofia", "Priya", "Monique", "Hannah", "Mei", "Camila", "Keisha", "Rachel",
  "Lauren", "Nia", "Isabella", "Grace", "Destiny", "Valeria", "Emily", "Tiana", "Ana", "Kayla",
  "Brianna", "Leilani", "Gabriela", "Megan", "Imani", "Samantha", "Olivia", "Lucia", "Natalie", "Ashley",
  "Mariana", "Daniela", "Alyssa", "Jocelyn", "Vanessa", "Bianca", "Maya", "Selena", "Adriana", "Kiara",
];
const NEUTRAL_NAMES = ["Jordan", "Alex", "Taylor", "Riley", "Casey", "Jamie", "Avery", "Quinn", "Skyler", "Rowan"];

// One letter per photo in web/public/sample-refs (001.jpg …): M, F or N (neutral name).
const PHOTO_NAME_STYLE = [
  "MFFMFFMFMFMMMMNF",
  "MFMMFMFFMMMFMMMM",
  "FFMMFFNFFFFFFMMF",
  "FMMFFFMFFFFMFMNM",
  "MFNFFMNFFMFFMFFF",
  "FNFFFFFFMNMMMMFF",
  "FNFFMFMFMFFFFFFF",
  "FFMFFFFFMNFFMNFM",
  "MMFFFNMFFFFFMFFM",
  "MFMMMMFFFMFFMFFM",
].join("");
const SAMPLE_PHOTO_DIR = path.join(__dirname, "..", "public", "sample-refs");
function samplePhotoFor(index) {
  const file = `${String(index).padStart(3, "0")}.jpg`;
  return fs.existsSync(path.join(SAMPLE_PHOTO_DIR, file)) ? `/sample-refs/${file}` : null;
}
const LAST_NAMES = [
  "Johnson", "Garcia", "Nguyen", "Williams", "Martinez", "Kim", "Brown", "Lopez", "Patel", "Davis",
  "Hernandez", "Robinson", "Chen", "Thomas", "Ramirez", "Jackson", "Flores", "Lee", "Harris", "Torres",
  "Walker", "Rivera", "Young", "Gonzalez", "Allen", "Morales", "King", "Reyes", "Wright", "Cruz",
  "Scott", "Ortiz", "Green", "Gutierrez", "Baker", "Diaz", "Adams", "Chavez", "Nelson", "Ruiz",
  "Carter", "Mendoza", "Mitchell", "Castillo", "Perez", "Tran", "Roberts", "Vargas", "Turner", "Park",
];

// Weighted so the marketplace looks like the sports GoTRefs actually serves.
const SPORTS = [
  ["Basketball", 30], ["Soccer", 25], ["Flag Football", 12], ["Volleyball", 10],
  ["Baseball", 8], ["Softball", 6], ["Tackle Football", 5], ["Lacrosse", 4],
];
function pickSport() {
  const total = SPORTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [sport, weight] of SPORTS) {
    roll -= weight;
    if (roll <= 0) return sport;
  }
  return SPORTS[0][0];
}

const CERT_LEVELS = ["Youth / Rec", "High School", "Club", "Adult League", "Collegiate"];

// Southern California ZIPs so refs spread across the map around the launch area.
const ZIPS = [
  "90250", "90260", "90266", "90245", "90277", "90278", "90503", "90501", "90301", "90304",
  "90045", "90066", "90230", "90034", "90019", "90018", "90011", "90016", "90026", "90039",
  "90042", "90065", "91101", "91106", "91201", "91205", "91506", "91601", "91605", "91401",
  "91335", "91342", "91711", "91766", "91789", "90601", "90603", "90640", "90650", "90703",
  "90712", "90805", "90807", "90813", "90802", "90731", "92801", "92805", "92840", "92701",
  "92704", "92626", "92618", "92614", "92660", "92647", "92683", "91730", "92335", "92501",
];

const BIO_TEMPLATES = [
  (s, y) => `${y} years officiating ${s.toLowerCase()} — youth leagues, tournaments and weekend showcases.`,
  (s, y) => `${s} official for ${y} seasons. Clear communicator, on time, calm under pressure.`,
  (s, y) => `Former player turned ${s.toLowerCase()} ref. ${y} years on the whistle across SoCal.`,
  (s, y) => `${y}+ years reffing ${s.toLowerCase()} for rec, club and high school events.`,
];

export function buildSampleRefs(count, takenIds = new Set()) {
  const refs = [];
  const usedNames = new Set();
  for (let i = 1; i <= count; i++) {
    const style = PHOTO_NAME_STYLE[i - 1];
    const pool =
      style === "M" ? MALE_NAMES : style === "F" ? FEMALE_NAMES : style === "N" ? NEUTRAL_NAMES
        : [...MALE_NAMES, ...FEMALE_NAMES, ...NEUTRAL_NAMES];
    let first, last;
    do {
      first = pick(pool);
      last = pick(LAST_NAMES);
    } while (usedNames.has(`${first} ${last}`));
    usedNames.add(`${first} ${last}`);

    let gotrefsId;
    do {
      gotrefsId = `GR-${between(100000, 999999)}`;
    } while (takenIds.has(gotrefsId));
    takenIds.add(gotrefsId);

    const sport = pickSport();
    const years = between(2, 18);
    const hourly = rand() < 0.6;
    const base = hourly ? between(25, 70) : between(40, 120);
    const useRange = rand() < 0.35;
    const others = SPORTS.map(([s]) => s).filter((s) => s !== sport);

    refs.push({
      email: `${SEED_EMAIL_PREFIX}${String(i).padStart(3, "0")}@${SEED_EMAIL_DOMAIN}`,
      firstName: first,
      lastName: last,
      homeZip: pick(ZIPS),
      photo: samplePhotoFor(i),
      profile: {
        gotrefs_id: gotrefsId,
        primary_sport: sport,
        additional_sports: rand() < 0.3 ? [pick(others)] : [],
        certification_level: pick(CERT_LEVELS),
        rate_unit: hourly ? "hour" : "game",
        rate_type: useRange ? "range" : "exact",
        rate_per_game: base,
        rate_min: useRange ? base : null,
        rate_max: useRange ? base + between(10, 30) : null,
        travel_radius_miles: pick([10, 15, 20, 25, 30, 40]),
        bio: pick(BIO_TEMPLATES)(sport, years),
      },
    });
  }
  return refs;
}

async function listSeedUsers(admin) {
  const byEmail = new Map();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.startsWith(SEED_EMAIL_PREFIX) && u.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
        byEmail.set(u.email, u);
      }
    }
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const countArg = args.indexOf("--count");
  const count = countArg >= 0 ? Number(args[countArg + 1]) : 200;
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error("--count must be a whole number between 1 and 1000");
  }

  if (dryRun) {
    const refs = buildSampleRefs(count);
    console.table(
      refs.slice(0, 15).map((r) => ({
        name: `${r.firstName} ${r.lastName}`,
        id: r.profile.gotrefs_id,
        sport: r.profile.primary_sport,
        zip: r.homeZip,
        rate: `$${r.profile.rate_per_game}/${r.profile.rate_unit}`,
        photo: r.photo ?? "initials",
      }))
    );
    console.log(`…${refs.length} sample refs total (dry run, nothing written).`);
    return;
  }

  const env = { ...loadEnvLocal(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingIds, error: idErr } = await admin
    .from("ref_profiles")
    .select("gotrefs_id")
    .not("gotrefs_id", "is", null);
  if (idErr) throw idErr;
  const existingSeedUsers = await listSeedUsers(admin);
  // Sample refs that already exist keep their GoTRefs ID so their QR codes never change.
  const keptIdByMember = new Map();
  if (existingSeedUsers.size > 0) {
    const { data } = await admin
      .from("ref_profiles")
      .select("member_id, gotrefs_id")
      .in("member_id", [...existingSeedUsers.values()].map((u) => u.id));
    for (const row of data ?? []) if (row.gotrefs_id) keptIdByMember.set(row.member_id, row.gotrefs_id);
  }
  const taken = new Set((existingIds ?? []).map((r) => r.gotrefs_id.toUpperCase()));
  const refs = buildSampleRefs(count, taken);

  let created = 0;
  let updated = 0;
  for (const ref of refs) {
    let user = existingSeedUsers.get(ref.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: ref.email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: {
          role: "ref",
          first_name: ref.firstName,
          last_name: ref.lastName,
          gotrefs_id: ref.profile.gotrefs_id,
          is_seed: true,
          seed_batch: SEED_BATCH,
        },
      });
      if (error) throw new Error(`${ref.email}: ${error.message}`);
      user = data.user;
      created++;
    } else {
      updated++;
      const kept = keptIdByMember.get(user.id);
      if (kept) ref.profile.gotrefs_id = kept;
    }

    const { error: memErr } = await admin
      .from("members")
      .update({
        is_seed: true,
        seed_batch: SEED_BATCH,
        home_zip: ref.homeZip,
        profile_picture_url: ref.photo,
      })
      .eq("id", user.id);
    if (memErr) throw new Error(`${ref.email} members: ${memErr.message}`);

    const { error: profErr } = await admin
      .from("ref_profiles")
      .update({ ...ref.profile, updated_at: new Date().toISOString() })
      .eq("member_id", user.id);
    if (profErr) throw new Error(`${ref.email} ref_profiles: ${profErr.message}`);

    if ((created + updated) % 25 === 0) console.log(`  ${created + updated}/${refs.length}`);
  }

  console.log(`Done: ${created} created, ${updated} updated (batch ${SEED_BATCH}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
