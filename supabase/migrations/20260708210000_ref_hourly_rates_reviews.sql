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
