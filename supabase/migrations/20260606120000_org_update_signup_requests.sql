-- Organizers can update ref signup request status on their own events (e.g. after sending an offer).

drop policy if exists "event_signup_requests_org_update" on public.event_signup_requests;

create policy "event_signup_requests_org_update"
  on public.event_signup_requests for update to authenticated
  using (
    exists (
      select 1 from public.scheduled_events e
      where e.id = event_signup_requests.event_id
        and e.organizer_member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.scheduled_events e
      where e.id = event_signup_requests.event_id
        and e.organizer_member_id = auth.uid()
    )
  );
