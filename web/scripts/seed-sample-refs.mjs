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

// Four cities per state so sample refs cover all 50 states (200 ZIPs, each used once).
const STATE_ZIPS = {
  AL: ["35203", "36104", "36602", "35801"], AK: ["99501", "99701", "99801", "99654"],
  AZ: ["85004", "85701", "85281", "86001"], AR: ["72201", "72701", "72401", "72901"],
  CA: ["90012", "94103", "92101", "95814"], CO: ["80202", "80903", "80302", "80521"],
  CT: ["06103", "06510", "06901", "06604"], DE: ["19801", "19901", "19711", "19958"],
  FL: ["33130", "32801", "33602", "32202"], GA: ["30303", "31401", "30901", "31201"],
  HI: ["96813", "96720", "96732", "96766"], ID: ["83702", "83402", "83201", "83814"],
  IL: ["60601", "62701", "61602", "61101"], IN: ["46204", "46802", "47401", "46601"],
  IA: ["50309", "52401", "52240", "52801"], KS: ["67202", "66603", "66044", "66502"],
  KY: ["40202", "40507", "42101", "40601"], LA: ["70112", "70801", "70501", "71101"],
  ME: ["04101", "04401", "04330", "04240"], MD: ["21202", "21401", "21701", "21801"],
  MA: ["02108", "01608", "01103", "02139"], MI: ["48226", "49503", "48933", "48104"],
  MN: ["55401", "55102", "55802", "55901"], MS: ["39201", "39530", "38801", "39401"],
  MO: ["63101", "64106", "65806", "65201"], MT: ["59101", "59802", "59715", "59601"],
  NE: ["68102", "68508", "68801", "69101"], NV: ["89101", "89501", "89701", "89014"],
  NH: ["03101", "03301", "03060", "03801"], NJ: ["07102", "08608", "07302", "08401"],
  NM: ["87102", "87501", "88001", "88201"], NY: ["10001", "14202", "12207", "14604"],
  NC: ["28202", "27601", "27701", "27401"], ND: ["58102", "58501", "58201", "58701"],
  OH: ["43215", "44113", "45202", "43604"], OK: ["73102", "74103", "73069", "74074"],
  OR: ["97204", "97401", "97301", "97701"], PA: ["19107", "15222", "17101", "18101"],
  RI: ["02903", "02860", "02840", "02886"], SC: ["29201", "29401", "29601", "29577"],
  SD: ["57104", "57701", "57501", "57401"], TN: ["37203", "38103", "37902", "37402"],
  TX: ["77002", "75201", "78701", "78205"], UT: ["84101", "84601", "84401", "84770"],
  VT: ["05401", "05602", "05701", "05301"], VA: ["23219", "23510", "22201", "24011"],
  WA: ["98101", "99201", "98402", "98501"], WV: ["25301", "26501", "25701", "26003"],
  WI: ["53202", "53703", "54301", "54601"], WY: ["82001", "82601", "82070", "82801"],
};
const ZIPS = Object.values(STATE_ZIPS).flat();

// Location and rate come from their own random stream so changing them never
// changes anyone's name, photo or GoTRefs ID.
const placeRand = mulberry32(50505);
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(placeRand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const RATE_MIN = 15;
const RATE_MAX = 30;
const rateBetween = (min, max) => Math.round(min + placeRand() * (max - min));

// ── Sport-specific descriptions ────────────────────────────────────────────
// Bios use their own random stream so rewriting them never changes anyone's
// name, photo, GoTRefs ID, location or rate.
const bioRand = mulberry32(90210);
const bioPick = (list) => list[Math.floor(bioRand() * list.length)];
const bioBetween = (min, max) => Math.round(min + bioRand() * (max - min));
const bioChance = (p) => bioRand() < p;

/** How each sport's officials talk about the job: the right title, career length and details. */
const SPORT_VOICE = {
  Basketball: {
    title: "basketball official",
    verb: "officiating basketball",
    years: [2, 14],
    details: [
      "Comfortable in two- and three-person crews.",
      "I keep the game moving and talk to coaches early.",
      "Strong on block/charge and off-ball contact.",
      "Good with table crews and running-clock formats.",
      "I like a clean pregame so partners are on the same page.",
      "Happy to take the early games or the late ones.",
      "I'll work back-to-backs all day at a tournament.",
    ],
  },
  Soccer: {
    title: "soccer referee",
    verb: "refereeing soccer",
    years: [1, 12],
    details: [
      "Center or assistant referee, small-sided through 11v11.",
      "Fit enough to keep up with older age groups.",
      "Comfortable working solo on small-sided fields.",
      "Good with advantage and managing the benches.",
      "I'd rather talk a player down than reach for a card.",
      "Assistant referee most weekends, center when needed.",
      "Experienced with indoor and 7v7 formats too.",
    ],
  },
  "Flag Football": {
    title: "flag football official",
    verb: "officiating flag football",
    years: [1, 7],
    details: [
      "I know 5v5 and 7v7 rule sets.",
      "Sharp on flag guarding and rush-line calls.",
      "Comfortable working alone or in a two-person crew.",
      "Good with younger divisions who are still learning the rules.",
      "I explain calls quickly so the game keeps its pace.",
      "Used to short fields and fast clocks.",
    ],
  },
  "Tackle Football": {
    title: "football official",
    verb: "officiating football",
    years: [3, 18],
    details: [
      "Mostly a line judge; I can fill in as back judge.",
      "I work in four- and five-person crews.",
      "Wing official who can step in as umpire.",
      "I know youth weight-limit and age-division rules.",
      "Player safety comes first on every snap.",
      "Experienced as crew chief for youth and JV crews.",
      "Friday nights and Saturday youth doubleheaders.",
    ],
  },
  Volleyball: {
    title: "volleyball referee",
    verb: "refereeing volleyball",
    years: [1, 4],
    details: [
      "First or second referee, and happy to line judge.",
      "Comfortable with rally scoring and libero tracking.",
      "Started as a line judge and moved up to the stand.",
      "I played, so I read the net well.",
      "Good with scorekeepers and rotation questions.",
      "Indoor mostly; I'll work sand tournaments in the summer.",
    ],
  },
  Baseball: {
    title: "baseball umpire",
    verb: "umpiring baseball",
    years: [2, 16],
    details: [
      "Plate or bases.",
      "Consistent strike zone from the first pitch to the last.",
      "I work one- and two-umpire systems.",
      "I bring my own plate gear.",
      "Good with pitch-count and time-limit tournaments.",
      "I'll take the plate in a doubleheader.",
      "Calm when a coach wants to talk about a call.",
    ],
  },
  Softball: {
    title: "softball umpire",
    verb: "umpiring softball",
    years: [2, 12],
    details: [
      "Fastpitch and slowpitch.",
      "Plate or bases in a two-umpire system.",
      "I know the pitching rules and call illegal pitches consistently.",
      "I bring my own plate gear.",
      "Used to long tournament days.",
      "Good with younger divisions and newer coaches.",
    ],
  },
  Lacrosse: {
    title: "lacrosse official",
    verb: "officiating lacrosse",
    years: [1, 8],
    details: [
      "I know both the boys' and girls' game.",
      "Two- and three-person mechanics.",
      "I played attack, so I see the crease well.",
      "Strict on checks to the head and neck.",
      "Comfortable with youth modifications and smaller fields.",
      "Good at explaining calls to newer programs.",
    ],
  },
};

/** Where they work, phrased to match the certification level on their card. */
const LEVEL_PHRASES = {
  "Youth / Rec": ["rec leagues", "youth leagues", "park district games", "elementary and middle school games", "weekend youth tournaments"],
  "High School": ["JV and varsity", "freshman through varsity", "high school and summer league", "middle school and high school games"],
  Club: ["club and travel tournaments", "travel teams", "club leagues", "weekend club showcases"],
  "Adult League": ["adult rec leagues", "men's and women's leagues", "adult and corporate leagues", "weeknight adult leagues"],
  Collegiate: ["small-college and junior college games", "college club and intramural games", "college scrimmages and high school varsity"],
};

const BACKGROUNDS = [
  "Played through high school.",
  "Played in college.",
  "Former youth coach.",
  "PE teacher during the week.",
  "Started when my kid's league was short on officials.",
  "Got into it through a friend on a crew.",
  "Coach for years before switching sides.",
  "Grew up around the game.",
];

const AVAILABILITY = [
  "Free most weekends.",
  "Weeknights after 5 and all day Saturday.",
  "Available for tournaments and doubleheaders.",
  "Weekday evenings only.",
  "Open all summer.",
  "Saturdays and Sundays.",
  "Flexible schedule; short notice is fine.",
];

function yearsPhrase(years, voice) {
  if (years === 1) {
    return bioPick([
      `In my first full season as a ${voice.title}.`,
      `New ${voice.title} with one season done.`,
      `One season ${voice.verb} so far.`,
    ]);
  }
  const ordinal = { 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth" }[years];
  const options = [
    `${years} years ${voice.verb}.`,
    `${voice.title[0].toUpperCase()}${voice.title.slice(1)} for ${years} years.`,
    `${years} seasons as a ${voice.title}.`,
    `Been ${voice.verb} for ${years} years.`,
  ];
  if (ordinal) options.push(`${ordinal} season as a ${voice.title}.`);
  if (years >= 10) options.push(`${years}+ years ${voice.verb}.`);
  return bioPick(options);
}

/** A career this short doesn't reach the college level; keep the card consistent. */
function realisticLevel(level, years) {
  if (level === "Collegiate" && years < 4) return years < 2 ? "Youth / Rec" : "High School";
  return level;
}

const usedBios = new Set();
function writeBio(sport, level, years) {
  const voice = SPORT_VOICE[sport];
  for (let attempt = 0; attempt < 40; attempt++) {
    const parts = [yearsPhrase(years, voice)];
    const where = bioPick(LEVEL_PHRASES[level]);
    parts.push(bioPick([`Mostly ${where}.`, `I work ${where}.`, `${where[0].toUpperCase()}${where.slice(1)}.`]));
    parts.push(bioPick(voice.details));
    if (bioChance(0.45)) parts.push(bioPick(BACKGROUNDS));
    if (bioChance(0.55)) parts.push(bioPick(AVAILABILITY));
    const bio = parts.join(" ");
    // Skip drafts that read awkwardly: two sentences opening the same way, or "played" twice.
    const openers = parts.map((part) => part.split(" ").slice(0, 2).join(" ").toLowerCase());
    if (new Set(openers).size !== openers.length) continue;
    if ((bio.match(/\bplayed\b/gi) ?? []).length > 1) continue;
    if (!usedBios.has(bio)) {
      usedBios.add(bio);
      return bio;
    }
  }
  throw new Error(`Could not write a unique bio for ${sport}`);
}

// Old generic templates (kept only so the main random stream stays in step).
const BIO_TEMPLATES = [
  (s, y) => `${y} years officiating ${s.toLowerCase()} — youth leagues, tournaments and weekend showcases.`,
  (s, y) => `${s} official for ${y} seasons. Clear communicator, on time, calm under pressure.`,
  (s, y) => `Former player turned ${s.toLowerCase()} ref. ${y} years on the whistle.`,
  (s, y) => `${y}+ years reffing ${s.toLowerCase()} for rec, club and high school events.`,
];

export function buildSampleRefs(count, takenIds = new Set()) {
  const refs = [];
  usedBios.clear();
  const zipOrder = shuffled(ZIPS);
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
    between(2, 18); // (was: years) kept so later picks don't shift
    const years = bioBetween(...SPORT_VOICE[sport].years);
    rand(); // (was: hourly vs per-game) kept so later picks don't shift
    rand(); // (was: base rate)
    const useRange = rand() < 0.35;
    const rateLow = rateBetween(RATE_MIN, RATE_MAX - (useRange ? 5 : 0));
    const rateHigh = useRange ? Math.min(RATE_MAX, rateLow + rateBetween(3, 8)) : rateLow;
    const others = SPORTS.map(([s]) => s).filter((s) => s !== sport);

    refs.push({
      email: `${SEED_EMAIL_PREFIX}${String(i).padStart(3, "0")}@${SEED_EMAIL_DOMAIN}`,
      firstName: first,
      lastName: last,
      homeZip: (pick(ZIPS), zipOrder[(i - 1) % zipOrder.length]),
      photo: samplePhotoFor(i),
      profile: {
        gotrefs_id: gotrefsId,
        primary_sport: sport,
        additional_sports: rand() < 0.3 ? [pick(others)] : [],
        certification_level: realisticLevel(pick(CERT_LEVELS), years),
        rate_unit: "hour",
        rate_type: useRange ? "range" : "exact",
        rate_per_game: rateLow,
        rate_min: useRange ? rateLow : null,
        rate_max: useRange ? (between(10, 30), rateHigh) : null,
        travel_radius_miles: pick([10, 15, 20, 25, 30, 40]),
        bio: (pick(BIO_TEMPLATES), ""), // written just below, once the level is known
      },
    });
    const profile = refs[refs.length - 1].profile;
    profile.bio = writeBio(sport, profile.certification_level, years);
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
