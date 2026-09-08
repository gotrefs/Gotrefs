# Google Maps + Places setup (GotREFS)

Used for:

- **Where** destination autocomplete (Places API)
- Explore **map** view (Maps JavaScript API)

## 1. Create / open a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one), e.g. `GotREFS`

## 2. Enable APIs

1. **APIs & Services → Library**
2. Enable **all** of these (missing any one causes the Where field “Oops!” and a blank grey map):
   - **Maps JavaScript API**
   - **Places API** (legacy — required for classic Autocomplete)
   - **Places API (New)** (recommended; enable alongside legacy)

## 3. Billing (most common cause of “Oops!”)

1. **Billing → Link a billing account** on the same Google Cloud project as the key
2. Without billing, Places shows **“Oops! Something went wrong.”** and the map stays grey
3. Maps still has a monthly free credit; you usually will not be charged for light use

## 4. Create an API key

1. **APIs & Services → Credentials → Create credentials → API key**
2. Copy the key
3. Click **Edit API key** (restrict it):

**Application restrictions**

- Choose **HTTP referrers (web sites)**
- Add **exactly** (include `www` if you use it):
  - `http://localhost:3000/*`
  - `https://gotrefs.org/*`
  - `https://www.gotrefs.org/*`
  - `https://*.vercel.app/*` (optional, for preview deploys)

If referrers are wrong, production shows Oops + grey map while localhost may work (or the reverse).

**API restrictions**

- Restrict key to:
  - Maps JavaScript API
  - Places API
  - Places API (New)

4. Save — wait 1–5 minutes for restrictions to apply

## 5. Add the key to GotREFS

**Local** — `web/.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

No `=` inside the value field in Vercel — use:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `your_key_here` |

Then restart `npm run dev` (local) or **Redeploy** (Vercel).

## 6. Test

1. Open referee dashboard → Explore → Map or Split
2. In **Where**, type a city (e.g. Granada Hills)
3. Pick a suggestion → map should center there
