import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const { customerId } = (await req.json()) as {
      customerId?: string;
    };

    if (!customerId) return routeJsonError("Missing customerId.");

    const customer = await getBillingCustomerRecord(supabase, customerId);
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        local_customer_id: customer.id,
        flow: "save_card",
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Stripe did not return a client secret.");
    }

    return NextResponse.json({
      ok: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not prepare card setup.", 500);
  }
}
