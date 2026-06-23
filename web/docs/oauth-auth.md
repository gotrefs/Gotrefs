# OAuth Authentication Setup

GotREFS uses Next.js App Router with Supabase Auth. Google, Facebook, and Apple OAuth codes are exchanged by Supabase, which verifies provider tokens and issues the secure Supabase session cookies used by the app.

## Routes

- Start OAuth:
  - `/api/auth/oauth/google`
  - `/api/auth/oauth/facebook`
  - `/api/auth/oauth/apple`
- Provider callbacks:
  - `/api/auth/callback/google`
  - `/api/auth/callback/facebook`
  - `/api/auth/callback/apple`

After the callback succeeds, the server:

- Exchanges the provider code for a Supabase session.
- Reads the verified Supabase user.
- Upserts `public.members` metadata.
- Sets `is_onboarded = false` for new users.
- Updates `last_login_at` for existing users.
- Redirects to `/dashboard` with secure HTTP-only Supabase cookies.

## Supabase Provider Configuration

In Supabase Dashboard -> Authentication -> Providers, enable each provider and set:

### Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Callback URL:
  - `https://YOUR_DOMAIN.com/api/auth/callback/google`
  - `http://localhost:3000/api/auth/callback/google`

### Facebook

- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- Callback URL:
  - `https://YOUR_DOMAIN.com/api/auth/callback/facebook`
  - `http://localhost:3000/api/auth/callback/facebook`

### Apple

- `APPLE_CLIENT_ID` (Services ID)
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- Callback URL:
  - `https://YOUR_DOMAIN.com/api/auth/callback/apple`
  - `http://localhost:3000/api/auth/callback/apple`

Apple only sends the name payload on the first sign-in. The callback service uses Apple’s first sign-in name when present, otherwise falls back to Supabase metadata or the email prefix.

## Database Migration

Run the migration:

`supabase/migrations/20260623132000_oauth_member_metadata.sql`

It adds:

- `members.email`
- `members.profile_picture_url`
- `members.auth_provider`
- `members.is_onboarded`
- `members.last_login_at`

## Frontend Routing

Landing-page social buttons now link to the backend OAuth start endpoints. Email signup still uses `/auth/signup`.
