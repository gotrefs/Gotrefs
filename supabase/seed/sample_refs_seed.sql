-- GoTRefs sample referees (20) — paste into Supabase → SQL Editor → Run.
-- Run AFTER supabase/migrations/20260929090000_seed_refs_flag.sql.
-- Safe to run twice: existing sample accounts are updated, not duplicated.
-- Any OTHER sample account (is_seed + gotrefs-sample-…@example.com) is deleted,
-- so the site ends up with exactly these 20. Real accounts are never touched.
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
  ('c315e03e-0f8a-4045-a389-39443a0c5e6c', 'gotrefs-sample-001@example.com', 'Carlos', 'Adams', '65201', '/sample-refs/001.jpg', 'GR-363076', 'Basketball', array['Softball']::text[], 'Club', 'hour', 'range', 16, 16, 21, 20, 'Been officiating basketball for 5 years. Mostly weekend club showcases. Happy to take the early games or the late ones. Played through high school. Flexible schedule; short notice is fine.'),
  ('d678e8a2-b768-4583-a049-667626fcaef7', 'gotrefs-sample-002@example.com', 'Isabella', 'Castillo', '80521', '/sample-refs/002.jpg', 'GR-873746', 'Baseball', array['Soccer']::text[], 'Club', 'hour', 'exact', 23, null, null, 10, '13+ years umpiring baseball. Weekend club showcases. I''ll take the plate in a doubleheader. Open all summer.'),
  ('8e8d590d-650d-4cf9-ae9f-50d7c9bba25f', 'gotrefs-sample-004@example.com', 'Sergio', 'Gonzalez', '23219', '/sample-refs/004.jpg', 'GR-448922', 'Softball', array[]::text[], 'Adult League', 'hour', 'range', 19, 19, 24, 10, '9 seasons as a softball umpire. Adult rec leagues. I bring my own plate gear.'),
  ('a7a365eb-480b-4f6b-ae43-aca6f6ce5d3d', 'gotrefs-sample-019@example.com', 'Sergio', 'Walker', '33130', '/sample-refs/019.jpg', 'GR-418759', 'Soccer', array[]::text[], 'High School', 'hour', 'exact', 26, null, null, 25, 'Soccer referee for 8 years. Freshman through varsity. Fit enough to keep up with older age groups. Grew up around the game. Available for tournaments and doubleheaders.'),
  ('acc6d376-48fb-48ec-a705-863e07a76c54', 'gotrefs-sample-024@example.com', 'Ashley', 'Thomas', '30303', '/sample-refs/024.jpg', 'GR-698197', 'Soccer', array[]::text[], 'Club', 'hour', 'range', 16, 16, 20, 25, 'Soccer referee for 3 years. Mostly travel teams. Assistant referee most weekends, center when needed. Weekday evenings only.'),
  ('5868d9ac-7c5a-445e-aa02-77b044881e71', 'gotrefs-sample-025@example.com', 'Dominic', 'Gonzalez', '27601', '/sample-refs/025.jpg', 'GR-283602', 'Flag Football', array[]::text[], 'High School', 'hour', 'range', 21, 21, 25, 40, 'Third season as a flag football official. I work JV and varsity. Used to short fields and fast clocks. Open all summer.'),
  ('1bfbb319-538d-4624-a66e-06b0dc12d8e1', 'gotrefs-sample-029@example.com', 'Jamal', 'Johnson', '60601', '/sample-refs/029.jpg', 'GR-199609', 'Basketball', array[]::text[], 'Club', 'hour', 'exact', 28, null, null, 10, 'Been officiating basketball for 11 years. I work travel teams. I like a clean pregame so partners are on the same page. Former youth coach. Free most weekends.'),
  ('b641ff4f-4458-4abe-a4fd-28dbca6aca50', 'gotrefs-sample-030@example.com', 'Miguel', 'Robinson', '08608', '/sample-refs/030.jpg', 'GR-906846', 'Baseball', array[]::text[], 'Adult League', 'hour', 'range', 22, 22, 29, 15, 'Been umpiring baseball for 5 years. Adult and corporate leagues. Good with pitch-count and time-limit tournaments.'),
  ('8c2ebb65-1b19-41e5-a2b3-442b18112e25', 'gotrefs-sample-036@example.com', 'Victor', 'Diaz', '19107', '/sample-refs/036.jpg', 'GR-305462', 'Softball', array[]::text[], 'Adult League', 'hour', 'exact', 27, null, null, 15, 'Softball umpire for 5 years. Adult rec leagues. I bring my own plate gear.'),
  ('af5cc099-5635-44ad-ae0e-7ce916c4ced3', 'gotrefs-sample-038@example.com', 'Selena', 'Ruiz', '55401', '/sample-refs/038.jpg', 'GR-587514', 'Flag Football', array['Volleyball']::text[], 'Club', 'hour', 'exact', 27, null, null, 25, 'Second season as a flag football official. I work weekend club showcases. Good with younger divisions who are still learning the rules.'),
  ('59d54669-182f-4a79-a5be-546d9c28b1c8', 'gotrefs-sample-039@example.com', 'Riley', 'Wright', '97204', '/sample-refs/039.jpg', 'GR-419639', 'Lacrosse', array[]::text[], 'Adult League', 'hour', 'exact', 26, null, null, 20, '7 seasons as a lacrosse official. Mostly weeknight adult leagues. Good at explaining calls to newer programs. Played through high school.'),
  ('f639841b-a7fc-4da7-aed5-0491d40a008e', 'gotrefs-sample-058@example.com', 'Ana', 'Johnson', '37402', '/sample-refs/058.jpg', 'GR-607992', 'Basketball', array[]::text[], 'Club', 'hour', 'exact', 18, null, null, 40, '9 years officiating basketball. Mostly travel teams. I keep the game moving and talk to coaches early. Coach for years before switching sides. Weeknights after 5 and all day Saturday.'),
  ('7b10254b-6760-4e9e-a751-01c65c22af0f', 'gotrefs-sample-061@example.com', 'Emily', 'Reyes', '94103', '/sample-refs/061.jpg', 'GR-507744', 'Soccer', array['Tackle Football']::text[], 'Club', 'hour', 'range', 19, 19, 24, 40, '8 years refereeing soccer. Mostly club leagues. I''d rather talk a player down than reach for a card. Open all summer.'),
  ('0b2c53fb-f8f2-4fdd-a387-92891b50beb5', 'gotrefs-sample-063@example.com', 'Skyler', 'Hernandez', '98101', '/sample-refs/063.jpg', 'GR-240916', 'Tackle Football', array[]::text[], 'Youth / Rec', 'hour', 'exact', 30, null, null, 15, 'Been officiating football for 9 years. Mostly park district games. I work in four- and five-person crews. Played through high school.'),
  ('23a8bde2-bcac-44fa-afa1-18f9942df945', 'gotrefs-sample-064@example.com', 'Elijah', 'Hernandez', '43215', '/sample-refs/064.jpg', 'GR-860017', 'Tackle Football', array[]::text[], 'Club', 'hour', 'exact', 20, null, null, 40, '9 years officiating football. Club and travel tournaments. Player safety comes first on every snap. Available for tournaments and doubleheaders.'),
  ('c014ea2a-b6c1-4c3b-a5b3-e7123423afe4', 'gotrefs-sample-065@example.com', 'Mateo', 'Jackson', '10001', '/sample-refs/065.jpg', 'GR-443987', 'Volleyball', array[]::text[], 'High School', 'hour', 'exact', 26, null, null, 40, 'Second season as a volleyball referee. I work high school and summer league. First or second referee, and happy to line judge. Coach for years before switching sides.'),
  ('590adfa3-5518-4314-a2eb-b83f9f422215', 'gotrefs-sample-087@example.com', 'Jasmine', 'Jackson', '78701', '/sample-refs/087.jpg', 'GR-232896', 'Flag Football', array[]::text[], 'Club', 'hour', 'exact', 22, null, null, 25, 'Flag football official for 7 years. I work weekend club showcases. I know 5v5 and 7v7 rule sets.'),
  ('e9cec0d0-b585-4338-a654-75251920af72', 'gotrefs-sample-090@example.com', 'Alex', 'Torres', '85281', '/sample-refs/090.jpg', 'GR-264564', 'Volleyball', array[]::text[], 'Club', 'hour', 'range', 20, 20, 24, 25, '3 years refereeing volleyball. I work travel teams. Comfortable with rally scoring and libero tracking. Played in college. Available for tournaments and doubleheaders.'),
  ('c1238c83-10a3-4fc5-ae96-3580564e50c5', 'gotrefs-sample-116@example.com', 'Lauren', 'Tran', '48104', '/sample-refs/116.jpg', 'GR-373800', 'Basketball', array[]::text[], 'Youth / Rec', 'hour', 'range', 21, 21, 24, 40, 'Been officiating basketball for 9 years. Mostly rec leagues. I keep the game moving and talk to coaches early. Started when my kid''s league was short on officials.'),
  ('197fd9e9-678d-4dcb-ae97-84841b9177d4', 'gotrefs-sample-118@example.com', 'Mariana', 'Morales', '02108', '/sample-refs/118.jpg', 'GR-627418', 'Lacrosse', array[]::text[], 'Youth / Rec', 'hour', 'exact', 19, null, null, 15, 'Lacrosse official for 2 years. Park district games. I know both the boys'' and girls'' game. Saturdays and Sundays.');

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
    'is_seed', true, 'seed_batch', 'sample-2026-09'
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
    seed_batch = 'sample-2026-09',
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

-- Remove every sample account that is not one of the 20 above.
delete from auth.users u
using public.members m
where m.id = u.id
  and m.is_seed
  and u.email like 'gotrefs-sample-%@example.com'
  and u.id not in (select id from sample_refs);

commit;

-- Should show 20:
select count(*) as sample_refs from public.members where is_seed;
