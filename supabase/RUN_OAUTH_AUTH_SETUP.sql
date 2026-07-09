-- =============================================================================
-- GotREFS OAuth + secure first-login setup — run once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste all of this → Run
--
-- ALSO configure these in the Supabase Dashboard (cannot be done via SQL alone):
--
-- 1) Authentication → URL Configuration
--    Site URL: https://YOUR_PRODUCTION_DOMAIN   (or http://localhost:3000 for local)
--    Redirect URLs (add every URL your app uses):
--      http://localhost:3000/auth/callback
--      https://YOUR_PRODUCTION_DOMAIN/auth/callback
--      http://localhost:3000/**
--      https://YOUR_PRODUCTION_DOMAIN/**
--
-- 2) Authentication → Providers → Google
--    Enable Google, paste Client ID + Secret from Google Cloud Console.
--    Authorized redirect URI in Google Cloud must match Supabase's callback, e.g.:
--      https://<project-ref>.supabase.co/auth/v1/callback
--
-- 3) Authentication → Email (optional for local dev)
--    Disable "Confirm email" if you rely on SUPABASE_SERVICE_ROLE_KEY auto-confirm locally.
--    If enabled, confirmation links must use /auth/callback (the app handles this).
-- =============================================================================

-- OAuth / onboarding columns on members
alter table public.members
  add column if not exists email text,
  add column if not exists profile_picture_url text,
  add column if not exists auth_provider text,
  add column if not exists is_onboarded boolean not null default false,
  add column if not exists last_login_at timestamptz;

create index if not exists members_email_lower_idx on public.members (lower(email));

-- New auth users get a members row; onboarding stays false until signup wizard completes.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  meta_role text := case when meta->>'role' = 'organizer' then 'organizer' else 'ref' end;
  fn text := nullif(trim(coalesce(meta->>'first_name', '')), '');
  ln text := nullif(trim(coalesce(meta->>'last_name', '')), '');
  org text := nullif(trim(coalesce(meta->>'organization_name', '')), '');
  display text := nullif(trim(concat_ws(' ', fn, ln)), '');
begin
  if display is null then
    display := nullif(trim(coalesce(meta->>'full_name', '')), '');
  end if;
  if display is null then
    display := split_part(new.email, '@', 1);
  end if;

  insert into public.members (
    id,
    role,
    display_name,
    first_name,
    last_name,
    organization_name,
    email,
    is_onboarded,
    last_login_at
  )
  values (
    new.id,
    meta_role,
    coalesce(display, 'User'),
    fn,
    ln,
    case when meta_role = 'organizer' then org else null end,
    lower(trim(new.email)),
    false,
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, public.members.email),
    last_login_at = now();

  if meta_role = 'ref' then
    insert into public.ref_profiles (member_id)
    values (new.id)
    on conflict (member_id) do nothing;

    insert into public.screening_checks (ref_member_id)
    values (new.id)
    on conflict (ref_member_id) do nothing;
  else
    insert into public.organizer_profiles (member_id)
    values (new.id)
    on conflict (member_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only onboarded members should read their own row through RLS (dashboard APIs still use service role where needed).
-- Existing policies are unchanged; is_onboarded is enforced in the Next.js middleware and auth APIs.

comment on column public.members.is_onboarded is
  'False until email or OAuth signup wizard completes. Middleware redirects incomplete users to /auth/signup?oauth=1&step=role.';
