-- Stripe money loop: Connect accounts, organizer payments, payee payouts, vendors, webhook idempotency.

create table if not exists public.stripe_connect_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members (id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express'
    check (account_type in ('express', 'standard', 'custom')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  tax_id_provided boolean not null default false,
  onboarding_complete boolean not null default false,
  requirements_due jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_connect_accounts_stripe_idx
  on public.stripe_connect_accounts (stripe_account_id);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  display_name text not null,
  contact_email text,
  member_id uuid references public.members (id) on delete set null,
  stripe_connect_account_id uuid references public.stripe_connect_accounts (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_organizer_idx on public.vendors (organizer_member_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organizer_member_id uuid not null references public.members (id) on delete cascade,
  event_id uuid references public.scheduled_events (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  purpose text not null default 'event_refs'
    check (purpose in ('event_refs', 'vendor', 'other')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  currency text not null default 'usd',
  amount_total_cents int not null check (amount_total_cents >= 0),
  amount_subtotal_cents int not null default 0 check (amount_subtotal_cents >= 0),
  platform_fee_cents int not null default 0 check (platform_fee_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'refunded', 'canceled')),
  accepted_offer_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_organizer_idx on public.payments (organizer_member_id);
create index if not exists payments_event_idx on public.payments (event_id);
create index if not exists payments_status_idx on public.payments (status);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments (id) on delete set null,
  event_id uuid references public.scheduled_events (id) on delete set null,
  offer_id uuid references public.assignment_offers (id) on delete set null,
  vendor_id uuid references public.vendors (id) on delete set null,
  payee_member_id uuid references public.members (id) on delete set null,
  stripe_connect_account_id text,
  stripe_transfer_id text unique,
  currency text not null default 'usd',
  gross_cents int not null check (gross_cents >= 0),
  status text not null default 'pending'
    check (status in (
      'pending',
      'pending_onboarding',
      'pending_tax',
      'processing',
      'paid',
      'failed',
      'canceled'
    )),
  tax_year int not null,
  failure_reason text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payouts_payee_check check (
    payee_member_id is not null or vendor_id is not null
  )
);

create index if not exists payouts_payee_year_idx on public.payouts (payee_member_id, tax_year);
create index if not exists payouts_status_idx on public.payouts (status);
create index if not exists payouts_payment_idx on public.payouts (payment_id);
create index if not exists payouts_offer_idx on public.payouts (offer_id);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

alter table public.assignment_offers
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded'));

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded'));

alter table public.stripe_connect_accounts enable row level security;
alter table public.vendors enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "stripe_connect_own_select" on public.stripe_connect_accounts;
create policy "stripe_connect_own_select"
  on public.stripe_connect_accounts for select to authenticated
  using (member_id = auth.uid());

drop policy if exists "vendors_organizer_all" on public.vendors;
create policy "vendors_organizer_all"
  on public.vendors for all to authenticated
  using (organizer_member_id = auth.uid())
  with check (organizer_member_id = auth.uid());

drop policy if exists "payments_organizer_select" on public.payments;
create policy "payments_organizer_select"
  on public.payments for select to authenticated
  using (organizer_member_id = auth.uid());

drop policy if exists "payouts_payee_select" on public.payouts;
create policy "payouts_payee_select"
  on public.payouts for select to authenticated
  using (payee_member_id = auth.uid());

drop policy if exists "payouts_organizer_select" on public.payouts;
create policy "payouts_organizer_select"
  on public.payouts for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payouts.payment_id and p.organizer_member_id = auth.uid()
    )
  );

-- Webhook events are service-role only (no authenticated policies).
