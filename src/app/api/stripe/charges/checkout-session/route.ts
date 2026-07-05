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
    const { customerId, amount, description, returnPath } = (await req.json()) as {
      customerId?: string;
      amount?: number;
      description?: string;
      returnPath?: string;
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
    const origin = new URL(req.url).origin;
    const fallbackPath = `/admin/customers/${customerId}?tab=billing`;
    const safeReturnPath =
      typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : fallbackPath;
    const itemDescription = description?.trim() || `Manual charge for ${customer.parent_name || customer.player_name}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: {
        local_customer_id: customer.id,
        flow: "manual_charge",
        description: itemDescription,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: itemDescription,
            },
          },
        },
      ],
      payment_intent_data: {
        description: itemDescription,
        metadata: {
          local_customer_id: customer.id,
          payment_origin: "admin_manual_charge",
          description: itemDescription,
        },
      },
      success_url: `${origin}${appendStripeState(safeReturnPath, "charge-paid")}`,
      cancel_url: `${origin}${appendStripeState(safeReturnPath, "charge-cancelled")}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not start charge checkout.", 500);
  }
}
