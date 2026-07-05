import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var __grindStripe__: Stripe | undefined;
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  if (!global.__grindStripe__) {
    global.__grindStripe__ = new Stripe(secretKey);
  }

  return global.__grindStripe__;
}
