-- Event visibility: each organizer sees only their events + ref requests on those events.
-- Refs see all published events from every organizer.

-- ─── scheduled_events ─────────────────────────────────────────────────────────
drop policy if exists "scheduled_events_org" on public.scheduled_events;
drop policy if exists "scheduled_events_org_manage" on public.scheduled_events;

create policy "scheduled_events_org_manage"
  on public.scheduled_events for all to authenticated
  using (
    organizer_member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.role = 'organizer'
    )
  )
  with check (
    organizer_member_id = auth.uid()
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.role = 'organizer'
    )
  );

drop policy if exists "scheduled_events_ref_read_published" on public.scheduled_events;

create policy "scheduled_events_ref_read_published"
  on public.scheduled_events for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.members m
      where m.id = auth.uid() and m.role = 'ref'
    )
  );

-- ─── event_signup_requests ───────────────────────────────────────────────────
drop policy if exists "event_signup_requests_org_select" on public.event_signup_requests;

create policy "event_signup_requests_org_select"
  on public.event_signup_requests for select to authenticated
  using (
    exists (
      select 1
      from public.scheduled_events e
      inner join public.members org on org.id = e.organizer_member_id
      where e.id = event_signup_requests.event_id
        and e.organizer_member_id = auth.uid()
        and org.role = 'organizer'
    )
  );

-- Refs may read signup requests only on published events (optional, for their own row only — already covered by ref_select)

comment on policy "scheduled_events_org_manage" on public.scheduled_events is
  'Organizers CRUD only events where organizer_member_id = their user id.';

comment on policy "scheduled_events_ref_read_published" on public.scheduled_events is
  'Refs read published events from all organizers for the marketplace calendar.';

comment on policy "event_signup_requests_org_select" on public.event_signup_requests is
  'Organizer A sees ref requests only for events owned by organizer A.';
