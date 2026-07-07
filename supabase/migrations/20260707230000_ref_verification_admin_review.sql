-- Manual admin verification review: tighten eligibility, admin access, NSID prep.

alter table public.ref_verification_submissions
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists review_version int not null default 1,
  add column if not exists verification_provider text not null default 'manual'
    check (verification_provider in ('manual', 'nsid', 'checkr')),
  add column if not exists external_verification_id text;

comment on column public.ref_verification_submissions.rejection_reason is
  'Shown to the referee when status is rejected.';
comment on column public.ref_verification_submissions.admin_notes is
  'Internal-only notes for platform admins.';
comment on column public.ref_verification_submissions.verification_provider is
  'Who approved/reviewed: manual admin, nsid webhook, or checkr screening.';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_self_read" on public.platform_admins;
create policy "platform_admins_self_read"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

drop policy if exists "ref_verification_submissions_admin_select" on public.ref_verification_submissions;
create policy "ref_verification_submissions_admin_select"
  on public.ref_verification_submissions for select to authenticated
  using (public.is_platform_admin());

drop policy if exists "ref_verification_submissions_admin_update" on public.ref_verification_submissions;
create policy "ref_verification_submissions_admin_update"
  on public.ref_verification_submissions for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Eligible only when admin-approved or cleared by Checkr/NSID (not upload-only).
create or replace function public.ref_is_offer_eligible(ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.ref_verification_submissions vs
      where vs.ref_member_id = ref_id and vs.status = 'approved'
    )
    or exists (
      select 1 from public.screening_checks sc
      where sc.ref_member_id = ref_id
        and sc.status = 'clear'
        and sc.provider in ('checkr', 'nsid')
    );
$$;

comment on function public.ref_is_offer_eligible(uuid) is
  'True when ref verification is admin-approved or cleared by Checkr/NSID.';
