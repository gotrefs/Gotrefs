-- GoTRefs catch-up: adds columns from migrations that were never run on the live
-- database (found with supabase/seed/check_missing_migrations.sql).
-- Every statement is "if not exists", so it's safe to run more than once.
-- Deliberately skips 20260513120000_gotrefs_profiles_events_storage.sql (legacy
-- profiles/events tables the app no longer uses).

begin;

-- 20260623132000_oauth_member_metadata.sql (is_onboarded / email already exist)
alter table public.members
  add column if not exists profile_picture_url text,
  add column if not exists auth_provider text;

-- ===== 20260626160000_pay_ranges.sql
-- Optional pay ranges for refs, organizer defaults, and posted events.

alter table public.ref_profiles
  add column if not exists rate_type text not null default 'exact'
    check (rate_type in ('exact', 'range')),
  add column if not exists rate_min numeric(10, 2),
  add column if not exists rate_max numeric(10, 2);

alter table public.organizer_profiles
  add column if not exists rate_type text not null default 'exact'
    check (rate_type in ('exact', 'range')),
  add column if not exists rate_min numeric(10, 2),
  add column if not exists rate_max numeric(10, 2);

alter table public.scheduled_events
  add column if not exists pay_type text not null default 'exact'
    check (pay_type in ('exact', 'range')),
  add column if not exists pay_min numeric(10, 2),
  add column if not exists pay_max numeric(10, 2);

-- ===== 20260708210000_ref_hourly_rates_reviews.sql
-- Hourly rate metadata, queryable GotREFS IDs, and review comments.

alter table public.ref_profiles
  add column if not exists gotrefs_id text,
  add column if not exists rate_unit text not null default 'hour'
    check (rate_unit in ('hour', 'game'));

alter table public.ref_ratings
  add column if not exists comment text;

create index if not exists ref_profiles_gotrefs_id_idx on public.ref_profiles (gotrefs_id)
  where gotrefs_id is not null;

-- Let organizers read ratings for refs who applied to their events (for trust signals).
drop policy if exists "ref_ratings_org_read_applicants" on public.ref_ratings;
create policy "ref_ratings_org_read_applicants"
  on public.ref_ratings for select to authenticated
  using (
    exists (
      select 1
      from public.event_signup_requests esr
      join public.scheduled_events e on e.id = esr.event_id
      where esr.ref_member_id = ref_ratings.ref_member_id
        and e.organizer_member_id = auth.uid()
    )
    or exists (
      select 1
      from public.assignment_offers ao
      join public.scheduled_events e on e.id = ao.event_id
      where ao.ref_member_id = ref_ratings.ref_member_id
        and e.organizer_member_id = auth.uid()
    )
  );

-- ===== 20260718190000_event_boosts.sql
-- Event boosts: organizers pick pay boosts in the listing wizard, and they are
-- applied to offers so refs earn (and organizers pay) the boosted amount.

alter table public.scheduled_events
  add column if not exists boosts text[] not null default '{}';

alter table public.assignment_offers
  add column if not exists boost_percent integer not null default 0,
  add column if not exists base_pay numeric(10, 2);

-- ===== 20260720210000_ref_recommended_assignor.sql
-- Optional assignor who recommended this referee to GotREFS.

alter table public.ref_profiles
  add column if not exists recommended_assignor_name text,
  add column if not exists recommended_assignor_email text,
  add column if not exists recommended_assignor_phone text;

-- ===== 20260727170000_ref_additional_certification_levels.sql
-- Extra certification levels beyond the primary certification_level on ref profiles.

alter table public.ref_profiles
  add column if not exists additional_certification_levels text[] not null default '{}';

comment on column public.ref_profiles.additional_certification_levels is
  'Extra certification levels beyond certification_level (e.g. varsity + college).';

-- ===== 20260824140000_ref_admin_queue_hidden.sql
-- Admin can hide referees from the verification queue without deleting their account.

alter table public.ref_profiles
  add column if not exists admin_queue_hidden_at timestamptz;

create index if not exists ref_profiles_admin_queue_hidden_idx
  on public.ref_profiles (admin_queue_hidden_at)
  where admin_queue_hidden_at is not null;

comment on column public.ref_profiles.admin_queue_hidden_at is
  'When set, this referee is hidden from the default admin verification queue.';

-- ===== Copy values that were only saved in account metadata into the new columns.
update public.ref_profiles rp
set gotrefs_id = upper(trim(u.raw_user_meta_data->>'gotrefs_id'))
from auth.users u
where u.id = rp.member_id
  and rp.gotrefs_id is null
  and coalesce(trim(u.raw_user_meta_data->>'gotrefs_id'), '') <> '';

update public.ref_profiles rp
set additional_certification_levels = array(
  select jsonb_array_elements_text(u.raw_user_meta_data->'additional_certification_levels')
)
from auth.users u
where u.id = rp.member_id
  and rp.additional_certification_levels = '{}'
  and jsonb_typeof(u.raw_user_meta_data->'additional_certification_levels') = 'array';

update public.members m
set profile_picture_url = coalesce(
  nullif(trim(u.raw_user_meta_data->>'profile_picture_url'), ''),
  nullif(trim(u.raw_user_meta_data->>'avatar_url'), '')
)
from auth.users u
where u.id = m.id
  and m.profile_picture_url is null
  and coalesce(nullif(trim(u.raw_user_meta_data->>'profile_picture_url'), ''), nullif(trim(u.raw_user_meta_data->>'avatar_url'), '')) is not null;

commit;

-- Re-run check_missing_migrations.sql afterwards: only the legacy 20260513 row should remain.
