-- =============================================================================
-- GotREFS admin verification setup — run once in Supabase SQL Editor
-- Dashboard → SQL → New query → paste all of this → Run
-- =============================================================================

-- Member columns used by admin review queue
alter table public.members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists is_onboarded boolean not null default false,
  add column if not exists last_login_at timestamptz;

-- Ref profile document paths
alter table public.ref_profiles
  add column if not exists government_id_path text,
  add column if not exists certification_document_path text,
  add column if not exists additional_sports text[];

-- Core submissions table (admin queue reads this)
create table if not exists public.ref_verification_submissions (
  ref_member_id uuid primary key references public.members (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  admin_notes text,
  fix_required_steps text[] not null default '{}',
  resubmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If table already existed from an older migration, add newer columns
alter table public.ref_verification_submissions
  add column if not exists fix_required_steps text[] not null default '{}',
  add column if not exists resubmitted_at timestamptz;

-- Ensure columns exist even if CREATE TABLE above was skipped (older schema)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ref_verification_submissions'
      and column_name = 'fix_required_steps'
  ) then
    alter table public.ref_verification_submissions
      add column fix_required_steps text[] not null default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ref_verification_submissions'
      and column_name = 'resubmitted_at'
  ) then
    alter table public.ref_verification_submissions
      add column resubmitted_at timestamptz;
  end if;
end $$;

alter table public.ref_verification_submissions enable row level security;

drop policy if exists "ref_verification_submissions_own" on public.ref_verification_submissions;
create policy "ref_verification_submissions_own"
  on public.ref_verification_submissions for all to authenticated
  using (ref_member_id = auth.uid())
  with check (ref_member_id = auth.uid());

comment on table public.ref_verification_submissions is
  'Tracks when a ref submits ID + certification for review. Files live in verification_documents storage.';

-- Optional view (app reads base tables directly; view is for Supabase browsing)
drop view if exists public.ref_verification_review_queue;
create view public.ref_verification_review_queue as
select
  s.ref_member_id,
  s.status,
  s.submitted_at,
  s.reviewed_at,
  s.admin_notes,
  s.fix_required_steps,
  s.resubmitted_at,
  s.created_at,
  s.updated_at,
  m.display_name,
  m.email,
  m.first_name,
  m.last_name,
  rp.primary_sport,
  rp.additional_sports,
  rp.certification_level,
  rp.government_id_path,
  rp.verification_doc_path as government_id_back_path,
  rp.certification_document_path,
  sc.status as screening_status,
  sc.summary as screening_summary
from public.ref_verification_submissions s
join public.members m on m.id = s.ref_member_id
left join public.ref_profiles rp on rp.member_id = s.ref_member_id
left join public.screening_checks sc on sc.ref_member_id = s.ref_member_id
where m.role = 'ref';

-- Backfill: refs who already uploaded docs during signup but have no submission row yet
insert into public.ref_verification_submissions (ref_member_id, status, submitted_at, updated_at)
select
  rp.member_id,
  'submitted',
  coalesce(m.last_login_at, now()),
  now()
from public.ref_profiles rp
join public.members m on m.id = rp.member_id
where m.role = 'ref'
  and (
    rp.government_id_path is not null
    or rp.verification_doc_path is not null
  )
  and rp.certification_document_path is not null
  and not exists (
    select 1
    from public.ref_verification_submissions s
    where s.ref_member_id = rp.member_id
  );

-- Mark screening pending for backfilled refs
update public.screening_checks sc
set
  status = 'pending',
  summary = 'Verification package submitted — pending admin review (1-2 business days)',
  updated_at = now()
from public.ref_verification_submissions vs
where vs.ref_member_id = sc.ref_member_id
  and vs.status = 'submitted'
  and (sc.status is null or sc.status not in ('clear', 'pending'));

-- Offer eligibility: only approved refs (or external/clear screening) can accept paid offers
create or replace function public.ref_is_offer_eligible(ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.screening_checks sc
      where sc.ref_member_id = ref_id and sc.status = 'clear'
    )
    or exists (
      select 1 from public.ref_profiles rp
      where rp.member_id = ref_id
        and rp.verification_method = 'external'
        and rp.external_verification_proof_path is not null
    )
    or exists (
      select 1 from public.ref_verification_submissions vs
      where vs.ref_member_id = ref_id
        and vs.status = 'approved'
    );
$$;
