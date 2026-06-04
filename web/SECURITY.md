# GoTRefs security architecture

## Passwords (never plain text)

- **Production:** Supabase Auth stores credentials in `auth.users`. Passwords are hashed with **bcrypt** on Supabase’s servers. Your app never writes `password_hash` to Postgres directly.
- **Utilities:** `src/lib/auth/password.ts` provides `hashPassword` / `verifyPassword` using **bcryptjs** (12 rounds). Use only for self-hosted auth or tooling — not for duplicating Supabase login.
- **Validation:** `/api/auth/register` enforces length, letter, and number rules before calling Supabase `signUp`.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public anon key (RLS enforced) |
| `NEXT_PUBLIC_SITE_URL` | Server | Email confirmation redirect base |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin APIs, webhooks — never expose to browser |
| `DATABASE_URL` | **Server only** | Optional direct Postgres (migrations, scripts) |
| `AUTH_SECRET` | **Server only** | Future signed tokens / sessions |

Copy `web/.env.example` → `web/.env.local`. **Never commit** `.env` or `.env.local` (see `.gitignore`).

## Application user model

| Layer | Table | Notes |
|-------|--------|------|
| Auth | `auth.users` | Email + bcrypt password (Supabase) |
| Profile | `public.members` | `id` = `auth.users.id`, role, name |
| Ref details | `public.ref_profiles` | Sport, rate, document paths |
| Verification workflow | `public.ref_verification_submissions` | `draft` → `submitted` → review |

Sample standalone `users (id, email, password_hash)` schema: `database/schema-users.sql`.

## Routes

- `POST /api/auth/register` — validated signup, sets httpOnly session cookie via Supabase SSR
- `POST /api/auth/login` — validated login
- `GET /auth/callback` — email confirmation code exchange
- `POST /api/verification/submit` — authenticated ref submits ID + cert package
- Middleware — redirects unauthenticated users away from `/dashboard/*`

## Document uploads

Files go to Supabase Storage bucket `verification_documents` with paths scoped by `user.id`. Access is controlled by storage policies and RLS on metadata tables.
