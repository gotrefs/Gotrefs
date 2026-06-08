-- Allow event publish when user is organizer by role, organizer_profiles row, or org name on members.

drop policy if exists "scheduled_events_org_manage" on public.scheduled_events;

create policy "scheduled_events_org_manage"
  on public.scheduled_events for all to authenticated
  using (
    organizer_member_id = auth.uid()
    and (
      exists (
        select 1 from public.members m
        where m.id = auth.uid()
          and (
            m.role = 'organizer'
            or nullif(trim(m.organization_name), '') is not null
          )
      )
      or exists (
        select 1 from public.organizer_profiles op
        where op.member_id = auth.uid()
      )
    )
  )
  with check (
    organizer_member_id = auth.uid()
    and (
      exists (
        select 1 from public.members m
        where m.id = auth.uid()
          and (
            m.role = 'organizer'
            or nullif(trim(m.organization_name), '') is not null
          )
      )
      or exists (
        select 1 from public.organizer_profiles op
        where op.member_id = auth.uid()
      )
    )
  );
