-- Schedule a one-time “add payout method” nudge ~24h after ref signup.

alter table public.ref_profiles
  add column if not exists payout_setup_nudge_due_at timestamptz,
  add column if not exists payout_setup_nudge_sent_at timestamptz;

create index if not exists ref_profiles_payout_nudge_due_idx
  on public.ref_profiles (payout_setup_nudge_due_at)
  where payout_setup_nudge_sent_at is null and payout_setup_nudge_due_at is not null;

comment on column public.ref_profiles.payout_setup_nudge_due_at is
  'When to email the ref to set up Stripe Connect payouts (usually signup + 1 day).';
comment on column public.ref_profiles.payout_setup_nudge_sent_at is
  'When the payout-setup nudge email was sent (null = not sent).';
