-- Paying REFS after the event: once a timesheet is approved, GotREFS pays the REF for the
-- work they did and charges the organizer for extra work (or refunds unused work).
-- These columns record that settlement so it only ever happens once. Safe to run more than once.

alter table public.booking_timesheets
  add column if not exists auto_approved boolean not null default false,
  add column if not exists settled_at timestamptz,
  add column if not exists ref_pay_cents integer,
  add column if not exists organizer_adjust_cents integer,
  add column if not exists adjust_status text,
  add column if not exists adjust_payment_id uuid,
  add column if not exists settle_error text;

alter table public.booking_timesheets drop constraint if exists booking_timesheets_adjust_status_check;
alter table public.booking_timesheets add constraint booking_timesheets_adjust_status_check
  check (adjust_status is null or adjust_status in ('none', 'charged', 'refunded', 'charge_failed', 'refund_failed'));

-- The site's server (service role) does all the writing.
grant all on public.booking_timesheets to service_role;

create index if not exists booking_timesheets_unsettled_idx
  on public.booking_timesheets (status) where settled_at is null;

-- Should show 7:
select count(*) as settlement_columns from information_schema.columns
where table_schema = 'public' and table_name = 'booking_timesheets'
  and column_name in ('auto_approved', 'settled_at', 'ref_pay_cents', 'organizer_adjust_cents',
                      'adjust_status', 'adjust_payment_id', 'settle_error');
