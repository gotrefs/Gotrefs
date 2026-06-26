-- Keep confirmed bookings aligned with an event's requested official count.

create unique index if not exists bookings_event_ref_unique_idx
  on public.bookings (event_id, ref_member_id);

create or replace function public.handle_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  needed_count int;
  booked_count int;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select e.officials_needed
      into needed_count
      from public.scheduled_events e
      where e.id = new.event_id;

    select count(*)
      into booked_count
      from public.bookings b
      where b.event_id = new.event_id
        and b.status in ('confirmed', 'completed');

    if booked_count >= needed_count then
      raise exception 'This event is already fully staffed.';
    end if;

    insert into public.bookings (offer_id, event_id, ref_member_id, organizer_member_id)
    select new.id, new.event_id, new.ref_member_id, e.organizer_member_id
    from public.scheduled_events e
    where e.id = new.event_id;
  end if;
  return new;
end;
$$;
