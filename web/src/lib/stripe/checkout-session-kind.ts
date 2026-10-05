import type Stripe from "stripe";

export type CheckoutSessionKind = "setup" | "payment" | "ignore";

/**
 * What a completed Checkout Session means for GoTRefs.
 * - "setup":   an organizer saved a card (no money moved) — never record a payment
 * - "payment": money was collected for refs or a vendor
 * - "ignore":  not finished, or nothing to do
 */
export function checkoutSessionKind(
  session: Pick<Stripe.Checkout.Session, "mode" | "status" | "payment_status" | "metadata">
): CheckoutSessionKind {
  if (session.mode === "setup" || session.metadata?.purpose === "organizer_default_pm") {
    return session.status === "complete" ? "setup" : "ignore";
  }
  if (session.mode === "subscription") return "ignore";
  if (session.payment_status === "paid" || session.status === "complete") return "payment";
  return "ignore";
}
