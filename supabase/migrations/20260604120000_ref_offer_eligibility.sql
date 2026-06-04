-- Allow offers when verification package is submitted or profile docs are complete.

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
        and vs.status in ('submitted', 'under_review', 'approved')
    )
    or exists (
      select 1 from public.ref_profiles rp
      where rp.member_id = ref_id
        and coalesce(rp.government_id_path, rp.verification_doc_path) is not null
        and rp.certification_document_path is not null
        and nullif(trim(rp.bio), '') is not null
        and nullif(trim(rp.primary_sport), '') is not null
        and nullif(trim(rp.certification_level), '') is not null
    );
$$;

create or replace function public.enforce_ref_screening_before_accept()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    if not public.ref_is_offer_eligible(new.ref_member_id) then
      raise exception 'SCREENING_NOT_CLEAR';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "members_select_verified_refs" on public.members;
create policy "members_select_verified_refs"
  on public.members for select to authenticated
  using (
    role = 'ref'
    and public.ref_is_offer_eligible(members.id)
  );

drop policy if exists "ref_profiles_read_verified" on public.ref_profiles;
create policy "ref_profiles_read_verified"
  on public.ref_profiles for select to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = ref_profiles.member_id
        and m.role = 'ref'
        and public.ref_is_offer_eligible(m.id)
    )
  );
