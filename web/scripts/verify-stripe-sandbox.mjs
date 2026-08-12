/**
 * Non-secret Stripe sandbox readiness check.
 * Usage: node --env-file=.env.local scripts/verify-stripe-sandbox.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error("Missing web/.env.local");
  }
  const env = { ...process.env };
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!(key in env) || !env[key]) env[key] = value;
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sk = env.STRIPE_SECRET_KEY || "";
const pk = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const wh = env.STRIPE_WEBHOOK_SECRET || "";

const report = {
  stripeSecretIsTest: sk.startsWith("sk_test_"),
  stripePublishableIsTest: pk.startsWith("pk_test_"),
  hasWebhookSecret: Boolean(wh),
  mfaBypassForTest: env.STRIPE_ALLOW_CONNECT_WITHOUT_MFA === "true",
  tables: {},
};

if (!url || !key) {
  console.log(JSON.stringify({ ...report, error: "Missing Supabase URL or service role key" }, null, 2));
  process.exit(1);
}

const tables = [
  "payments",
  "payouts",
  "stripe_connect_accounts",
  "vendors",
  "stripe_webhook_events",
];

for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  report.tables[table] = { ok: res.ok, status: res.status };
}

const allTablesOk = tables.every((t) => report.tables[t]?.ok);
const ready =
  report.stripeSecretIsTest &&
  report.stripePublishableIsTest &&
  allTablesOk;

console.log(JSON.stringify({ ready, ...report, nextSteps: ready
  ? [
      "Install Stripe CLI if needed: https://stripe.com/docs/stripe-cli",
      "stripe login",
      "stripe listen --forward-to localhost:3000/api/webhooks/stripe",
      "Copy the whsec_… value into STRIPE_WEBHOOK_SECRET in .env.local and restart npm run dev",
      "Ref: Connect + W-9 → Organizer: Pay event → card 4242… → Admin 1099 panel + Organizer Payments tab",
    ]
  : [
      "Ensure sk_test_ / pk_test_ keys are set",
      "Apply supabase/migrations/20260731120000_stripe_payments_connect_ledger.sql in the Supabase SQL editor if tables are missing",
    ],
}, null, 2));

process.exit(ready ? 0 : 1);
