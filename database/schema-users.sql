-- Sample users table for secure registration (self-hosted pattern).
-- Passwords are NEVER stored as plain text — only password_hash (bcrypt).
--
-- GoTRefs production uses Supabase Auth instead of this table for credentials:
--   • auth.users (managed by Supabase) — encrypted_password (bcrypt)
--   • public.members (id = auth.users.id) — profile, role, no password column
--
-- Run the GoTRefs migrations in supabase/migrations/ for the live schema.

-- ─── Standalone pattern (Node/Postgres without Supabase Auth) ────────────────
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));

comment on table public.users is 'Application users; password_hash = bcrypt (12+ rounds), never plaintext.';
comment on column public.users.password_hash is 'bcrypt hash only — generate with hashPassword() in web/src/lib/auth/password.ts';

-- ─── GoTRefs: link app profile to Supabase Auth ─────────────────────────────
-- (Already created by 20260213130000_gotrefs_marketplace.sql)
--
-- create table public.members (
--   id uuid primary key references auth.users (id) on delete cascade,
--   role text not null check (role in ('ref', 'organizer')),
--   display_name text not null,
--   ...
-- );
