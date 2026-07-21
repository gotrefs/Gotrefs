-- Optional assignor who recommended this referee to GotREFS.

alter table public.ref_profiles
  add column if not exists recommended_assignor_name text,
  add column if not exists recommended_assignor_email text,
  add column if not exists recommended_assignor_phone text;
