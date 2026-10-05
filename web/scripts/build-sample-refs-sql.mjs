/**
 * Writes supabase/seed/sample_refs_seed.sql from the same data as seed-sample-refs.mjs,
 * so the sample refs can be created by pasting SQL into the Supabase SQL editor.
 * It keeps the 20 refs in KEPT_SAMPLE_NUMBERS and removes every other sample account.
 *   node scripts/build-sample-refs-sql.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildKeptSampleRefs, SEED_BATCH, SEED_EMAIL_DOMAIN, SEED_EMAIL_PREFIX } from "./seed-sample-refs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "..", "supabase", "seed", "sample_refs_seed.sql");

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null ? "null" : String(Number(v)));
const arr = (list) => `array[${list.map(q).join(", ")}]::text[]`;
// Stable id per sample email so re-running never duplicates.
function stableUuid(email) {
  const h = crypto.createHash("sha256").update(`gotrefs-sample:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const refs = buildKeptSampleRefs();
const rows = refs.map((r) => {
  const p = r.profile;
  return `  (${[
    q(stableUuid(r.email)), q(r.email), q(r.firstName), q(r.lastName), q(r.homeZip), q(r.photo),
    q(p.gotrefs_id), q(p.primary_sport), arr(p.additional_sports), q(p.certification_level),
    q(p.rate_unit), q(p.rate_type), num(p.rate_per_game), num(p.rate_min), num(p.rate_max),
    num(p.travel_radius_miles), q(p.bio),
  ].join(", ")})`;
});

const sql = `-- GoTRefs sample referees (${refs.length}) — paste into Supabase → SQL Editor → Run.
-- Run AFTER supabase/migrations/20260929090000_seed_refs_flag.sql.
-- Safe to run twice: existing sample accounts are updated, not duplicated.
-- Any OTHER sample account (is_seed + ${SEED_EMAIL_PREFIX}…@${SEED_EMAIL_DOMAIN}) is deleted,
-- so the site ends up with exactly these ${refs.length}. Real accounts are never touched.
-- These accounts cannot log in (no password) and can never be booked.
-- Remove them all later with supabase/seed/sample_refs_delete.sql.

begin;

create temporary table sample_refs (
  id uuid, email text, first_name text, last_name text, home_zip text, photo text,
  gotrefs_id text, primary_sport text, additional_sports text[], certification_level text,
  rate_unit text, rate_type text, rate_per_game numeric, rate_min numeric, rate_max numeric,
  travel_radius_miles int, bio text
) on commit drop;

insert into sample_refs values
${rows.join(",\n")};

-- Login accounts (the on_auth_user_created trigger adds members + ref_profiles rows).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated', s.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'role', 'ref', 'first_name', s.first_name, 'last_name', s.last_name,
    'full_name', s.first_name || ' ' || s.last_name, 'gotrefs_id', s.gotrefs_id,
    'is_seed', true, 'seed_batch', '${SEED_BATCH}'
  ),
  now(), now(), '', '', '', ''
from sample_refs s
on conflict (id) do nothing;

-- In case the signup trigger didn't create the member row.
insert into public.members (id, role, display_name, first_name, last_name)
select s.id, 'ref', s.first_name || ' ' || s.last_name, s.first_name, s.last_name
from sample_refs s
on conflict (id) do nothing;

update public.members m
set is_seed = true,
    seed_batch = '${SEED_BATCH}',
    role = 'ref',
    display_name = s.first_name || ' ' || s.last_name,
    first_name = s.first_name,
    last_name = s.last_name,
    home_zip = s.home_zip,
    profile_picture_url = s.photo
from sample_refs s
where m.id = s.id;

insert into public.ref_profiles (
  member_id, gotrefs_id, primary_sport, additional_sports, certification_level,
  rate_unit, rate_type, rate_per_game, rate_min, rate_max, travel_radius_miles, bio, updated_at
)
select
  s.id, s.gotrefs_id, s.primary_sport, s.additional_sports, s.certification_level,
  s.rate_unit, s.rate_type, s.rate_per_game, s.rate_min, s.rate_max, s.travel_radius_miles, s.bio, now()
from sample_refs s
on conflict (member_id) do update set
  gotrefs_id = excluded.gotrefs_id,
  primary_sport = excluded.primary_sport,
  additional_sports = excluded.additional_sports,
  certification_level = excluded.certification_level,
  rate_unit = excluded.rate_unit,
  rate_type = excluded.rate_type,
  rate_per_game = excluded.rate_per_game,
  rate_min = excluded.rate_min,
  rate_max = excluded.rate_max,
  travel_radius_miles = excluded.travel_radius_miles,
  bio = excluded.bio,
  updated_at = now();

-- Remove every sample account that is not one of the ${refs.length} above.
delete from auth.users u
using public.members m
where m.id = u.id
  and m.is_seed
  and u.email like '${SEED_EMAIL_PREFIX}%@${SEED_EMAIL_DOMAIN}'
  and u.id not in (select id from sample_refs);

commit;

-- Should show ${refs.length}:
select count(*) as sample_refs from public.members where is_seed;
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sql);
console.log(`Wrote ${out} (${refs.length} refs)`);
