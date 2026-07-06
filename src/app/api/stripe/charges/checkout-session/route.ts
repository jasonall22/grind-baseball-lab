import { NextResponse } from "next/server";
import Stripe from "stripe";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";

type PaymentStatus = "Pending" | "Succeeded" | "Failed" | "Cancelled" | "Refunded";

function paymentStatusFromIntent(status: Stripe.PaymentIntent.Status): PaymentStatus {
  switch (status) {
    case "succeeded":
      return "Succeeded";
    case "canceled":
      return "Cancelled";
    case "requires_payment_method":
      return "Failed";
    default:
      return "Pending";
  }
}

async function upsertPaymentIntentRecord(
  supabase: any,
  stripe: Stripe,
  localCustomerId: string,
  intent: Stripe.PaymentIntent
) {
  let paymentMethodBrand: string | null = null;
  let paymentMethodLast4: string | null = null;
  let receiptUrl: string | null = null;

  if (typeof intent.latest_charge === "string") {
    const charge = await stripe.charges.retrieve(intent.latest_charge);
    paymentMethodBrand = charge.payment_method_details?.card?.brand ?? null;
    paymentMethodLast4 = charge.payment_method_details?.card?.last4 ?? null;
    receiptUrl = charge.receipt_url ?? null;
  }

  const upsertResult = await supabase.from("booking_customer_payments").upsert(
    {
      customer_id: localCustomerId,
      booking_id: intent.metadata.local_booking_id || null,
      stripe_payment_intent_id: intent.id,
      amount_cents: intent.amount_received || intent.amount || 0,
      currency: intent.currency || "usd",
      status: paymentStatusFromIntent(intent.status),
      description: intent.description || intent.metadata.description || null,
      payment_method_brand: paymentMethodBrand,
      payment_method_last4: paymentMethodLast4,
      receipt_url: receiptUrl,
      processed_at: new Date((intent.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    },
    { onConflict: "stripe_payment_intent_id" }
  );

  if (upsertResult.error) throw upsertResult.error;
}

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const { customerId, amount, description } = (await req.json()) as {
      customerId?: string;
      amount?: number;
      description?: string;
    };

    if (!customerId) return routeJsonError("Missing customerId.");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return routeJsonError("Enter a valid charge amount.");
    }

    const amountCents = Math.round(parsedAmount * 100);
    const customer = await getBillingCustomerRecord(supabase, customerId);
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);
    const itemDescription = description?.trim() || `Manual charge for ${customer.parent_name || customer.player_name}`;

    const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    if (stripeCustomer.deleted) {
      return routeJsonError("Stripe customer record is no longer available.", 409);
    }

    const expandedDefaultPaymentMethod = stripeCustomer.invoice_settings.default_payment_method;
    const defaultPaymentMethodId =
      (typeof expandedDefaultPaymentMethod === "string"
        ? expandedDefaultPaymentMethod
        : expandedDefaultPaymentMethod?.id) || customer.stripe_default_payment_method_id;

    if (!defaultPaymentMethodId) {
      return routeJsonError("Add a saved card before charging this customer.", 409);
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      description: itemDescription,
      metadata: {
        local_customer_id: customer.id,
        payment_origin: "admin_manual_charge",
        description: itemDescription,
      },
    });

    if (intent.status !== "succeeded") {
      return routeJsonError("Charge did not complete. Please verify the customer's card and try again.", 409);
    }

    if (defaultPaymentMethodId !== customer.stripe_default_payment_method_id) {
      const updateResult = await supabase
        .from("booking_customers")
        .update({ stripe_default_payment_method_id: defaultPaymentMethodId })
        .eq("id", customer.id);

      if (updateResult.error) throw updateResult.error;
    }

    await upsertPaymentIntentRecord(supabase, stripe, customer.id, intent);

    return NextResponse.json({
      ok: true,
      charge: {
        id: intent.id,
        amountCents,
        currency: intent.currency,
        status: intent.status,
      },
    });
  } catch (error) {
    console.error(error);

    if (error instanceof Stripe.errors.StripeCardError) {
      return routeJsonError(error.message || "The customer's card was declined.", 402);
    }

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return routeJsonError(error.message || "Stripe could not process that charge.", 400);
    }

    return routeJsonError(error instanceof Error ? error.message : "Could not charge saved card.", 500);
  }
}
