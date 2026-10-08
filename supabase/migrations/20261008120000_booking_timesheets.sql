-- Timesheets: check-in / clock-out for each booked REF, and the REF's sign-off.
-- The organizer checks a REF in by scanning their QR code and clocks them out after.
-- Games or hours worked come from the organizer; the REF signs off when they differ
-- from what was booked. All writes go through the site's server (service role).
-- Safe to run more than once.

create table if not exists public.booking_timesheets (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  event_id uuid not null references public.scheduled_events (id) on delete cascade,
  ref_member_id uuid not null references public.members (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  pay_unit text not null default 'game' check (pay_unit in ('game', 'hour')),
  rate numeric(10, 2),
  booked_units numeric(6, 2) not null default 1 check (booked_units >= 0),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  worked_units numeric(6, 2) check (worked_units is null or worked_units >= 0),
  -- True when the organizer changed the hours from what the clock said.
  units_edited boolean not null default false,
  status text not null default 'checked_in'
    check (status in ('checked_in', 'awaiting_ref', 'approved', 'disputed')),
  submitted_at timestamptz,
  ref_decided_at timestamptz,
  dispute_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_timesheets_ref_idx on public.booking_timesheets (ref_member_id);
create index if not exists booking_timesheets_org_idx on public.booking_timesheets (organizer_member_id);
create index if not exists booking_timesheets_event_idx on public.booking_timesheets (event_id);

alter table public.booking_timesheets enable row level security;

-- The REF and the organizer of that booking can read it. Nobody writes from the browser.
drop policy if exists "booking_timesheets_parties_read" on public.booking_timesheets;
create policy "booking_timesheets_parties_read"
  on public.booking_timesheets for select to authenticated
  using (ref_member_id = auth.uid() or organizer_member_id = auth.uid());

revoke all on public.booking_timesheets from anon;
revoke insert, update, delete on public.booking_timesheets from authenticated;
grant select on public.booking_timesheets to authenticated;

comment on table public.booking_timesheets is
  'Check-in/clock-out per booking (organizer scans the REF QR). worked_units is games or hours; the REF approves when it differs from booked_units.';

-- Should show 1:
select count(*) as timesheets_table from information_schema.tables
where table_schema = 'public' and table_name = 'booking_timesheets';
