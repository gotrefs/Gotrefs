# GoTRefs security architecture

## Secrets: how to keep them private

| Do | Don’t |
|----|--------|
| Put secrets only in `web/.env.local` (local) or Vercel Environment Variables (prod) | Paste API keys into chat, email, or GitHub |
| Copy from `web/.env.example` → `web/.env.local` | Commit `.env`, `.env.local`, or real keys |
| Use `serverEnv` / `publicEnv` accessors | Scatter `process.env.SECRET` in client components |

**Chat is not a vault.** Anything pasted into Cursor chat can be stored in conversation history. To give the app credentials safely: open `web/.env.local` yourself and paste there. `.gitignore` and `.cursorignore` keep those files out of git and out of agent context.

If secrets were ever pasted into chat, **rotate them** in Supabase / Google / Resend and update `.env.local`.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Public anon key (RLS enforced) |
| `NEXT_PUBLIC_SITE_URL` | Client + server | Email / OAuth redirect base |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin APIs, webhooks — never expose to browser |
| `SUPABASE_SECRET_KEY` | **Server only** | Newer Supabase secret key (optional) |
| `RESEND_API_KEY` | **Server only** | Transactional email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **Server / Supabase Auth** | Google OAuth (also configure in Supabase Dashboard) |
| `DATABASE_URL` | **Server only** | Optional direct Postgres |
| `AUTH_SECRET` | **Server only** | Future signed tokens / sessions |

Code layout:

- `src/lib/env/public.ts` — browser-safe `NEXT_PUBLIC_*` helpers
- `src/lib/env/server.ts` — secrets + `import "server-only"` (build fails if imported from client)

## Passwords (never plain text)

- **Production:** Supabase Auth stores credentials in `auth.users`. Passwords are hashed with **bcrypt** on Supabase’s servers. Your app never writes `password_hash` to Postgres directly.
- **Utilities:** `src/lib/auth/password.ts` provides `hashPassword` / `verifyPassword` using **bcryptjs** (12 rounds). Use only for self-hosted auth or tooling — not for duplicating Supabase login.
- **Validation:** `/api/auth/register` enforces length, letter, and number rules before calling Supabase `signUp`.

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
