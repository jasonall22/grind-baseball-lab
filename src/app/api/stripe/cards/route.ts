import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";

export async function GET(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const customerId = new URL(req.url).searchParams.get("customerId")?.trim();

    if (!customerId) return routeJsonError("Missing customerId.");

    const customer = await getBillingCustomerRecord(supabase, customerId);

    if (!customer.stripe_customer_id) {
      return NextResponse.json({ ok: true, cards: [], defaultPaymentMethodId: null });
    }

    const stripe = getStripe();
    const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id);
    const defaultPaymentMethodId =
      !("deleted" in stripeCustomer) && typeof stripeCustomer.invoice_settings.default_payment_method === "string"
        ? stripeCustomer.invoice_settings.default_payment_method
        : customer.stripe_default_payment_method_id;

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.stripe_customer_id,
      type: "card",
      limit: 25,
    });

    return NextResponse.json({
      ok: true,
      defaultPaymentMethodId: defaultPaymentMethodId ?? null,
      cards: paymentMethods.data.map((paymentMethod) => ({
        id: paymentMethod.id,
        brand: paymentMethod.card?.brand ?? "card",
        last4: paymentMethod.card?.last4 ?? "0000",
        expMonth: paymentMethod.card?.exp_month ?? 0,
        expYear: paymentMethod.card?.exp_year ?? 0,
      })),
    });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not load saved cards.", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const { customerId, paymentMethodId } = (await req.json()) as {
      customerId?: string;
      paymentMethodId?: string;
    };

    if (!customerId || !paymentMethodId) {
      return routeJsonError("Missing customerId or paymentMethodId.");
    }

    const customer = await getBillingCustomerRecord(supabase, customerId);
    if (!customer.stripe_customer_id) {
      return routeJsonError("Customer has no Stripe profile.", 404);
    }

    const stripe = getStripe();
    const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id);
    const defaultPaymentMethodId =
      !("deleted" in stripeCustomer) && typeof stripeCustomer.invoice_settings.default_payment_method === "string"
        ? stripeCustomer.invoice_settings.default_payment_method
        : customer.stripe_default_payment_method_id;

    if (defaultPaymentMethodId === paymentMethodId) {
      await stripe.customers.update(customer.stripe_customer_id, {
        invoice_settings: { default_payment_method: null as unknown as string },
      });
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    if (customer.stripe_default_payment_method_id === paymentMethodId) {
      const updateResult = await supabase
        .from("booking_customers")
        .update({ stripe_default_payment_method_id: null })
        .eq("id", customer.id);
      if (updateResult.error) throw updateResult.error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not remove card.", 500);
  }
}
