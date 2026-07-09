-- Pending refs can browse/apply to open games, but only approved refs receive or accept organizer offers.

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

comment on function public.ref_is_offer_eligible(uuid) is
  'True when a ref may appear in the verified directory and accept paid assignment offers (approved verification, external proof, or clear screening).';
