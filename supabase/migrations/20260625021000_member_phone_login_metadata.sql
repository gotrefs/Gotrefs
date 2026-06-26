-- Store safe contact/login metadata for confirmed users.
-- Passwords stay in Supabase Auth only and are never stored in public tables.

alter table public.members
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists is_onboarded boolean not null default false,
  add column if not exists last_login_at timestamptz;

comment on column public.members.phone is
  'User-provided phone number. Protected by members RLS policies.';

comment on column public.members.email is
  'Confirmed account email mirrored from Supabase Auth for admin/search workflows.';

comment on column public.members.is_onboarded is
  'False until the user completes role-specific progressive onboarding.';

comment on column public.members.last_login_at is
  'Updated when auth callback or account sync runs.';
