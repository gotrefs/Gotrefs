-- Admin review queue: join submission status with ref profile document paths and member info.
-- Ensures member columns exist first (older projects may not have run later migrations).

alter table public.members
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists is_onboarded boolean not null default false,
  add column if not exists last_login_at timestamptz;

alter table public.ref_profiles
  add column if not exists government_id_path text,
  add column if not exists certification_document_path text,
  add column if not exists additional_sports text[];

create table if not exists public.ref_verification_submissions (
  ref_member_id uuid primary key references public.members (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ref_verification_submissions enable row level security;

drop policy if exists "ref_verification_submissions_own" on public.ref_verification_submissions;
create policy "ref_verification_submissions_own"
  on public.ref_verification_submissions for all to authenticated
  using (ref_member_id = auth.uid())
  with check (ref_member_id = auth.uid());

create or replace view public.ref_verification_review_queue as
select
  s.ref_member_id,
  s.status,
  s.submitted_at,
  s.reviewed_at,
  s.admin_notes,
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

comment on view public.ref_verification_review_queue is
  'Pending referee verifications for admin review. Document files are in storage bucket verification_documents at the paths shown.';
