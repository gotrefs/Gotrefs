-- Needs-info after an approval must block game requests even if screening was
-- previously "clear". under_review / submitted / rejected always block.

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
      or (
        exists (
          select 1 from public.ref_profiles rp
          where rp.member_id = ref_id
            and rp.verification_method = 'external'
            and rp.external_verification_proof_path is not null
        )
        and not exists (
          select 1 from public.ref_verification_submissions vs
          where vs.ref_member_id = ref_id
            and vs.status in ('rejected', 'under_review', 'submitted')
        )
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
  'True when a ref may request/accept games. Approved only while status stays approved; needs-info (under_review), submitted, and rejected always block.';
