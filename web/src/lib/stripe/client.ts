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
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

export function dollarsToCents(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export function taxYearForDate(date = new Date()) {
  return date.getUTCFullYear();
}
