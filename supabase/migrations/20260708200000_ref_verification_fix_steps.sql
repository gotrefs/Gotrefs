-- Admin can request specific signup steps be fixed; refs resubmit only those steps.

alter table public.ref_verification_submissions
  add column if not exists fix_required_steps text[] not null default '{}',
  add column if not exists resubmitted_at timestamptz;

comment on column public.ref_verification_submissions.fix_required_steps is
  'Signup step keys the ref must redo: profile, sports, government_id, certification, location.';

comment on column public.ref_verification_submissions.resubmitted_at is
  'Set when a ref completes a fix/resubmit cycle and sends verification back to admin review.';

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
