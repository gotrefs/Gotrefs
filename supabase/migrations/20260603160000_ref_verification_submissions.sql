-- Referee identity package: separate doc types + submission workflow for admin review.

alter table public.ref_profiles
  add column if not exists government_id_path text,
  add column if not exists certification_document_path text;

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

comment on table public.ref_verification_submissions is
  'Tracks when a ref submits ID + certification for review. Files live in verification_documents storage.';
