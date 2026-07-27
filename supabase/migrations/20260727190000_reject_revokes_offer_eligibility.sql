-- Rejected / revoked verification must block game requests even if screening was
-- previously marked clear from an earlier approval.

create or replace function public.ref_is_offer_eligible(ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1
      from public.ref_verification_submissions vs
      where vs.ref_member_id = ref_id
        and vs.status in ('rejected', 'under_review', 'submitted')
    )
    and (
      exists (
        select 1 from public.ref_verification_submissions vs
        where vs.ref_member_id = ref_id
          and vs.status = 'approved'
      )
      or exists (
        select 1 from public.ref_profiles rp
        where rp.member_id = ref_id
          and rp.verification_method = 'external'
          and rp.external_verification_proof_path is not null
      )
      or (
        exists (
          select 1 from public.screening_checks sc
          where sc.ref_member_id = ref_id and sc.status = 'clear'
        )
        and not exists (
          select 1 from public.ref_verification_submissions vs
          where vs.ref_member_id = ref_id
        )
      )
    );
$$;

comment on function public.ref_is_offer_eligible(uuid) is
  'True when a ref may request/accept games. Approved (or external proof / legacy clear) only; rejected or pending review always blocks.';
