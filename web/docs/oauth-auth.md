# OAuth Authentication Setup

GotREFS uses Next.js App Router with Supabase Auth. Google, Facebook, and Apple OAuth codes are exchanged by Supabase, which verifies provider tokens and issues secure HTTP-only session cookies.

## Routes

- **Start OAuth** (server action — preferred for PKCE cookies):
  - `signInWithOAuthAction` in `src/lib/auth/oauth-actions.ts`
- **Start OAuth** (API fallback):
  - `/api/auth/oauth/google`
  - `/api/auth/oauth/facebook`
  - `/api/auth/oauth/apple`
- **Single callback** (email confirmation + all OAuth providers):
  - `/auth/callback`

After the callback succeeds, the server:

1. Exchanges the provider code (or email OTP) for a Supabase session.
2. Upserts `public.members` metadata.
3. Leaves `is_onboarded = false` for brand-new users.
4. Redirects new users to `/auth/signup?oauth=1&step=role` to finish profile setup.
5. Redirects returning onboarded users to their role dashboard (`/dashboard/referee`, `/dashboard/organizer`, or `/dashboard/admin`).

## Supabase Dashboard Configuration

### URL configuration (required)

**Authentication → URL configuration**

| Setting | Value |
|--------|--------|
| Site URL | `https://YOUR_DOMAIN` (or `http://localhost:3000` locally) |
| Redirect URLs | `http://localhost:3000/auth/callback` |
| | `https://YOUR_DOMAIN/auth/callback` |
| | Optional wildcards: `http://localhost:3000/**`, `https://YOUR_DOMAIN/**` |

`NEXT_PUBLIC_SITE_URL` in `.env.local` must match the Site URL.

### Google provider

**Authentication → Providers → Google**

- Enable Google.
- Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console.
- In Google Cloud, authorized redirect URI is Supabase’s callback:
  - `https://<project-ref>.supabase.co/auth/v1/callback`

The app uses `prompt: "select_account"` so users can pick the correct Google account.

### Facebook / Apple

Same pattern: enable in Supabase, set secrets, use Supabase’s `/auth/v1/callback` in the provider console.

## Database

Run in Supabase SQL Editor:

- `supabase/RUN_OAUTH_AUTH_SETUP.sql` (columns + `handle_new_user` trigger)
- Or migration: `supabase/migrations/20260623132000_oauth_member_metadata.sql`

Key column: `members.is_onboarded` — `false` until the signup wizard completes (email register API or `POST /api/auth/complete-oauth-signup`).

## First-login flow

| Path | First visit | After wizard |
|------|-------------|--------------|
| Google OAuth | `/auth/signup?oauth=1&step=role` | Role dashboard |
| Email signup | Full wizard in one session → `is_onboarded: true` | Role dashboard |
| Email login (incomplete) | Middleware → signup wizard | Role dashboard |
| Returning user | Role dashboard directly | — |

Middleware (`src/lib/supabase/middleware.ts`) blocks `/dashboard/*` until `is_onboarded` is true and sends `/dashboard` to the correct role path.
