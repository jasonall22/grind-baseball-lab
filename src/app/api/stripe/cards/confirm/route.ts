import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const { customerId, setupIntentId } = (await req.json()) as {
      customerId?: string;
      setupIntentId?: string;
    };

    if (!customerId || !setupIntentId) {
      return routeJsonError("Missing customerId or setupIntentId.");
    }

    const customer = await getBillingCustomerRecord(supabase, customerId);
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== "succeeded") {
      return routeJsonError("Card setup is not complete yet.", 409);
    }

    if (typeof setupIntent.customer === "string" && setupIntent.customer !== stripeCustomerId) {
      return routeJsonError("That setup does not belong to this customer.", 403);
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;

    if (!paymentMethodId) {
      return routeJsonError("Stripe did not return a saved payment method.", 409);
    }

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const updateResult = await supabase
      .from("booking_customers")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_default_payment_method_id: paymentMethodId,
      })
      .eq("id", customer.id);

    if (updateResult.error) throw updateResult.error;

    return NextResponse.json({
      ok: true,
      paymentMethodId,
    });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not save card.", 500);
  }
}
