import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";

function appendStripeState(path: string, stripeState: string) {
  return `${path}${path.includes("?") ? "&" : "?"}stripe=${encodeURIComponent(stripeState)}`;
}

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const { customerId, returnPath } = (await req.json()) as {
      customerId?: string;
      returnPath?: string;
    };

    if (!customerId) return routeJsonError("Missing customerId.");

    const customer = await getBillingCustomerRecord(supabase, customerId);
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);
    const origin = new URL(req.url).origin;
    const fallbackPath = `/admin/customers/${customerId}?tab=billing`;
    const safeReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : fallbackPath;

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: {
        local_customer_id: customer.id,
        flow: "save_card",
      },
      setup_intent_data: {
        metadata: {
          local_customer_id: customer.id,
          flow: "save_card",
        },
      },
      success_url: `${origin}${appendStripeState(safeReturnPath, "card-added")}`,
      cancel_url: `${origin}${appendStripeState(safeReturnPath, "card-cancelled")}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not start card setup.", 500);
  }
}
