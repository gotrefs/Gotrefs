# Google Maps + Places setup (GotREFS)

Used for:

- **Where** destination autocomplete (Places API)
- Explore **map** view (Maps JavaScript API)

## 1. Create / open a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one), e.g. `GotREFS`

## 2. Enable APIs

1. **APIs & Services → Library**
2. Enable:
   - **Maps JavaScript API**
   - **Places API** (for autocomplete)

## 3. Create an API key

1. **APIs & Services → Credentials → Create credentials → API key**
2. Copy the key
3. Click **Edit API key** (restrict it):

**Application restrictions**

- Choose **HTTP referrers (web sites)**
- Add:
  - `http://localhost:3000/*`
  - `https://gotrefs.org/*`
  - `https://*.vercel.app/*` (optional, for preview deploys)

**API restrictions**

- Restrict key to:
  - Maps JavaScript API
  - Places API

4. Save

## 4. Billing

Google requires a billing account on the project (there is a monthly free credit for Maps). Without billing, the map/autocomplete may not load.

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
