-- OAuth login metadata and progressive onboarding state.

alter table public.members
  add column if not exists email text,
  add column if not exists profile_picture_url text,
  add column if not exists auth_provider text,
  add column if not exists is_onboarded boolean not null default false,
  add column if not exists last_login_at timestamptz;

create unique index if not exists members_email_lower_unique_idx
  on public.members (lower(email))
  where email is not null;

comment on column public.members.is_onboarded is
  'False until the user completes the role-specific progressive onboarding flow.';

comment on column public.members.last_login_at is
  'Updated after successful email/password or OAuth login.';
