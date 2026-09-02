-- Organizer-set games per offer + saved payment method for auto-charge on accept.

alter table public.assignment_offers
  add column if not exists games_count integer not null default 1;

alter table public.assignment_offers
  drop constraint if exists assignment_offers_games_count_check;

alter table public.assignment_offers
  add constraint assignment_offers_games_count_check check (games_count >= 1);

comment on column public.assignment_offers.games_count is
  'Number of games in this assignment, set by the organizer (refs cannot change it).';

alter table public.organizer_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists default_payment_method_id text,
  add column if not exists payment_method_brand text,
  add column if not exists payment_method_last4 text,
  add column if not exists payment_method_type text,
  add column if not exists payment_method_updated_at timestamptz;

create unique index if not exists organizer_profiles_stripe_customer_uidx
  on public.organizer_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.organizer_profiles.stripe_customer_id is
  'Stripe Customer id for charging the organizer on GotRefs platform account.';
comment on column public.organizer_profiles.default_payment_method_id is
  'Default PaymentMethod id (card or US bank) attached to the customer.';
