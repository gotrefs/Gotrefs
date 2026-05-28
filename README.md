# GoTRefs — Setup Guide

**GitHub repository:** [github.com/gotrefs/Gotrefs](https://github.com/gotrefs/Gotrefs)

### Push code to GitHub

```powershell
cd "C:\Users\alexk\OneDrive\Desktop\Cursor GotRefs"
git push -u origin main
```

### Deploy on Vercel

1. Import [github.com/gotrefs/Gotrefs](https://github.com/gotrefs/Gotrefs) at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `web`.
3. Add environment variables from `web/.env.example`, then deploy.

---

## 1. Supabase (database + storage)

### A. Create a project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Wait until the database is ready.

### B. Apply the migration

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you have not already.
2. From this project folder, link your project (`supabase link`) or paste the SQL from `supabase/migrations/20260513120000_gotrefs_profiles_events_storage.sql` into the Supabase SQL Editor and run it once.

This creates:

- **`profiles`** — referee onboarding rows (`role` must be `ref`).
- **`events`** — organizer / event request rows.
- **Storage bucket** `verification_documents` — private uploads for certification files.
- **RLS policies** — anonymous inserts allowed for those tables and for uploads (anon key from the site).

### C. Site configuration (`officialconnect_config.json`)

Open `officialconnect_config.json` and set your Supabase **Project URL** and **anon public** key from **Project Settings → API**.

```json
{
  "supabaseUrl": "https://YOUR_PROJECT_REF.supabase.co",
  "supabaseAnonKey": "YOUR_SUPABASE_ANON_PUBLIC_KEY"
}
```

> **Security note:** The anon key is public by design; protect your data with **Row Level Security** (included in the provided migration). Do not put the **service role** key in the browser.

---

## 2. Hosting the Site

We recommend **Netlify** (free tier, fastest setup):

1. Go to [netlify.com](https://netlify.com) and sign up.
2. Click **Add new site** → **Deploy manually**.
3. Drag your project folder (the one with `index.html`, `styles.css`, `script.js`) onto the drop zone.
4. Netlify gives you a temporary URL like `https://random-name.netlify.app` — your site is live.

---

## 3. Changing Your Domain (GoDaddy → Netlify)

You don't need to transfer the domain away from GoDaddy. You just point GoDaddy's DNS at Netlify — the domain stays in GoDaddy, but traffic goes to your Netlify site.

### Step-by-step

**In Netlify:**
1. Go to your site dashboard → **Domain management** → **Add a custom domain**.
2. Enter your GoDaddy domain (e.g. `gotrefs.com`) → click **Verify**.
3. Netlify will tell you which DNS records to add. You'll get either:
   - An **A record** pointing to `75.2.60.5` (Netlify's IP), **or**
   - A **CNAME record** pointing to your `.netlify.app` URL.
   Copy whichever Netlify shows you.

**In GoDaddy:**
1. Log in → go to **My Products** → click **DNS** next to your domain.
2. In the DNS Records table:
   - Find the existing **A record** for `@` (the root domain). Click the pencil icon and change the value to `75.2.60.5`.
   - If Netlify gave you a CNAME instead, add a new CNAME record with Name: `www` and Value: your `xxxxx.netlify.app` URL.
3. Save changes.

**Wait for propagation:** DNS changes take 10 minutes to 48 hours to spread worldwide. You can check progress at [dnschecker.org](https://dnschecker.org).

**Enable HTTPS (free, automatic):**
Back in Netlify → Domain management → scroll to **HTTPS** → click **Verify DNS configuration** → then **Provision certificate**. Netlify handles SSL for free via Let's Encrypt.

### Optional: full domain transfer to Netlify

If you want to move the domain registration itself out of GoDaddy (so everything is in one place), you can transfer it to [Netlify Domains](https://docs.netlify.com/domains-https/netlify-dns/). The process takes about 5–7 days and requires unlocking the domain in GoDaddy first. It's optional — pointing DNS as above works just as well.

---

## 4. Quick checklist before going live

- [ ] Migration applied in Supabase (tables, RLS, storage bucket)
- [ ] `officialconnect_config.json` filled with real **Project URL** and **anon** key
- [ ] Site deployed to Netlify (or another static host)
- [ ] Custom domain pointed at the host (if applicable)
- [ ] HTTPS certificate provisioned
- [ ] Test referee flow: row in `profiles`, file in `verification_documents`
- [ ] Test organizer flow: row in `events`

---

## 5. Next.js marketplace app (`web/`)

The full product (auth, dashboards, offers, bookings, Checkr hooks) lives in **`web/`**.

1. Copy `web/.env.example` to `web/.env.local` and set Supabase URL + anon key (and **service role** key for webhooks / screening updates — server only, never commit).

2. In Supabase SQL Editor (or CLI), run **`supabase/migrations/20260213130000_gotrefs_marketplace.sql`** after your existing legacy migration (or on a fresh project). It adds `members`, `ref_profiles`, `scheduled_events`, `assignment_offers`, `bookings`, `screening_checks`, RLS, and storage policies.

3. From **`web/`**: `npm run dev` then open `http://localhost:3000`.

4. **Checkr (optional):** set `CHECKR_API_KEY`, `CHECKR_PACKAGE_SLUG`, and `CHECKR_WEBHOOK_SECRET`. Point Checkr’s webhook URL to `https://<your-domain>/api/webhooks/checkr`. For local development only, `SCREENING_DEV_BYPASS=true` marks screening as clear without calling Checkr.

5. **Deploy:** Vercel (recommended for Next.js) or similar — set the same env vars — add **gotrefs.org** in the host dashboard and point DNS.

**Important:** Background screening does not literally “prove someone is not a criminal.” It returns adjudications from a licensed consumer reporting agency subject to law (for example FCRA in the United States). Work with counsel on consent, adverse action, and copy on your site.
