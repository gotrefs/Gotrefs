-- Seed (sample) referee accounts used to fill out the marketplace UI before launch.
-- Every seeded row is flagged so it can be found and removed in one step:
--   delete from auth.users where id in (select id from public.members where is_seed);
-- (members, ref_profiles, screening_checks cascade from auth.users.)

alter table public.members
  add column if not exists is_seed boolean not null default false,
  add column if not exists seed_batch text;

create index if not exists members_is_seed_idx on public.members (is_seed) where is_seed;

comment on column public.members.is_seed is
  'True for sample referee accounts created by web/scripts/seed-sample-refs.mjs. Never bookable; remove with web/scripts/delete-sample-refs.mjs.';
comment on column public.members.seed_batch is
  'Label of the seed run that created this row (e.g. sample-2026-09).';

-- Travel radius was only kept in auth metadata; store it on the profile so the
-- Find Refs page can filter by it. Backfill existing refs from their metadata.
alter table public.ref_profiles
  add column if not exists travel_radius_miles integer;

update public.ref_profiles rp
set travel_radius_miles = round((u.raw_user_meta_data->>'travel_radius_miles')::numeric)::int
from auth.users u
where u.id = rp.member_id
  and rp.travel_radius_miles is null
  and (u.raw_user_meta_data->>'travel_radius_miles') ~ '^[0-9]+(\.[0-9]+)?$';

-- Sample refs can never request, accept, or be offered games,
-- regardless of any verification rows that might exist for them.
create or replace function public.ref_is_offer_eligible(ref_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not exists (
      select 1 from public.members m
      where m.id = ref_id and m.is_seed
    )
    and not exists (
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
  'True when a ref may request/accept games. Sample (is_seed) refs never. Approved only while status stays approved; needs-info (under_review), submitted, and rejected always block.';
