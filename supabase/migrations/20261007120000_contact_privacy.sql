-- Contact details stay between each person and GotREFS.
-- REFS and organizers must never be able to read each other's email or phone.
-- The site only reads these columns on the server (service role), so logged-in
-- users lose read access to them here. Safe to run more than once.

-- 1) members.email / members.phone
--    Logged-in users keep reading every other members column (names, photo, role…).
--    NOTE: a column added to members later is NOT readable by logged-in users until
--    it is granted the same way (re-running this file does that).
revoke select on table public.members from anon, authenticated;
do $$
declare col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'members'
      and column_name not in ('email', 'phone')
  loop
    execute format('grant select (%I) on public.members to authenticated', col);
  end loop;
end $$;

-- 2) ref_profiles: the assignor a REF recommended (someone else's contact details).
revoke select on table public.ref_profiles from anon, authenticated;
do $$
declare col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'ref_profiles'
      and column_name not in ('recommended_assignor_email', 'recommended_assignor_phone')
  loop
    execute format('grant select (%I) on public.ref_profiles to authenticated', col);
  end loop;
end $$;

-- 3) The admin review-queue view lists every REF with their email. Views run with the
--    owner's rights (they skip row security), so only the server may read it.
do $$
begin
  if to_regclass('public.ref_verification_review_queue') is not null then
    execute 'revoke all on public.ref_verification_review_queue from anon, authenticated';
  end if;
end $$;

-- Check (should return no rows): contact columns a logged-in user can still read.
select table_name, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'SELECT'
  and (column_name ilike '%email%' or column_name ilike '%phone%')
  and table_name in ('members', 'ref_profiles', 'ref_verification_review_queue');
