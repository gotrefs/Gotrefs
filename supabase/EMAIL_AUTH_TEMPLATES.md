# Supabase email templates (fix PKCE / cross-device links)

By default, Supabase auth emails use a `code` flow that requires a PKCE verifier cookie
stored in the **same browser** that requested the email. That breaks when users open the
link from a mail app, phone, or different browser — you see:

> PKCE code verifier not found in storage

Update these templates in **Supabase Dashboard → Authentication → Email Templates**.

**Site URL** must be `https://gotrefs.org` (not localhost).

---

## Reset password (Recovery)

Replace the link in the **Reset password** template with:

```html
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=%2Fauth%2Fupdate-password">Reset your password</a></p>
```

This uses `token_hash` + `verifyOtp` in `/auth/callback` — works from any device.

---

## Confirm signup

Replace the link in the **Confirm signup** template with:

```html
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=%2Fdashboard">Confirm your email</a></p>
```

After confirm, the app reads the user's role from signup metadata and sends them to the
correct dashboard (referee, organizer, or assignor).

---

## After saving templates

1. Request a **new** forgot-password or signup email (old links still use the old format).
2. Click the new link — it should land on `gotrefs.org`, not localhost.
3. Password reset → **Set your password** page. Signup confirm → role dashboard.
