import "server-only";

import Stripe from "stripe";
import { serverEnv } from "@/lib/env/server";

export function getStripe(): Stripe {
  const secretKey = serverEnv.stripeSecretKey() || process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(secretKey);
}

export function stripeWebhookSecret(): string | undefined {
  return stripeWebhookSecrets()[0];
}

/**
 * Every Stripe webhook signing secret this deployment accepts. Each Stripe event
 * destination has its own secret, e.g. one for "Your account" events and one for
 * "Connected accounts" events, so both must be configured:
 *   STRIPE_WEBHOOK_SECRET          — destination listening to your account
 *   STRIPE_CONNECT_WEBHOOK_SECRET  — destination listening to connected accounts
 * Either variable may also hold several secrets separated by commas (handy while rolling a secret).
 */
export function stripeWebhookSecrets(): string[] {
  const raw = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET];
  const secrets = raw
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(secrets)];
}

export function dollarsToCents(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export function taxYearForDate(date = new Date()) {
  return date.getUTCFullYear();
}
