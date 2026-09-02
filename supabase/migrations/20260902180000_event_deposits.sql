-- Refundable organizer deposit: 1 extra game at rate per hired ref (no platform fee on deposit).

create table if not exists public.event_deposits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.scheduled_events (id) on delete cascade,
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  required_cents int not null default 0 check (required_cents >= 0),
  collected_cents int not null default 0 check (collected_cents >= 0),
  applied_cents int not null default 0 check (applied_cents >= 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'held', 'partially_used', 'refunded', 'forfeited')),
  collections jsonb not null default '[]'::jsonb,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_deposits_organizer_idx
  on public.event_deposits (organizer_member_id);

create index if not exists event_deposits_status_idx
  on public.event_deposits (status);

comment on table public.event_deposits is
  'Organizer refundable deposit held per event (1 game rate × each paid ref; no 20% fee on deposit).';

comment on column public.event_deposits.collections is
  'Array of {paymentId, paymentIntentId, amountCents} for deposit portions charged.';

alter table public.event_deposits enable row level security;

drop policy if exists "event_deposits_org_select" on public.event_deposits;
create policy "event_deposits_org_select"
  on public.event_deposits for select to authenticated
  using (organizer_member_id = auth.uid());
