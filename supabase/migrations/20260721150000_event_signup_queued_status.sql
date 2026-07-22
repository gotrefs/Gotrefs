-- Allow refs to queue a game request before GotREFS admin verification approval.
-- Organizers only see status = 'pending'. On admin approve, queued rows become pending
-- and organizers are emailed.

alter table public.event_signup_requests
  drop constraint if exists event_signup_requests_status_check;

alter table public.event_signup_requests
  add constraint event_signup_requests_status_check
  check (status in ('pending', 'queued', 'withdrawn', 'accepted', 'declined'));

comment on column public.event_signup_requests.status is
  'pending = visible to organizer; queued = held until ref verification is approved; accepted/declined/withdrawn = terminal';
