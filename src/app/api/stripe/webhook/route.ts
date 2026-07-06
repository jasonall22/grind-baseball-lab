import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripe, normalizeStripeKey } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

async function lookupLocalCustomerId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  metadataCustomerId: string | undefined,
  stripeCustomerId: string | null
) {
  if (metadataCustomerId) return metadataCustomerId;
  if (!stripeCustomerId) return null;

  const result = await supabase
    .from("booking_customers")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (result.error) throw result.error;
  return ((result.data as { id?: string } | null)?.id ?? null);
}

async function upsertPaymentIntentRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  intent: Stripe.PaymentIntent
) {
  const admin = supabase as any;
  const stripeCustomerId = typeof intent.customer === "string" ? intent.customer : null;
  const localCustomerId = await lookupLocalCustomerId(
    supabase,
    intent.metadata.local_customer_id,
    stripeCustomerId
  );

  if (!localCustomerId) return;

  let paymentMethodBrand: string | null = null;
  let paymentMethodLast4: string | null = null;
  let receiptUrl: string | null = null;

  if (typeof intent.latest_charge === "string") {
    const charge = await stripe.charges.retrieve(intent.latest_charge);
    paymentMethodBrand = charge.payment_method_details?.card?.brand ?? null;
    paymentMethodLast4 = charge.payment_method_details?.card?.last4 ?? null;
    receiptUrl = charge.receipt_url ?? null;
  }

  const upsertResult = await admin.from("booking_customer_payments").upsert(
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

  if (intent.metadata.local_booking_id && intent.status === "succeeded") {
    const bookingUpdate = await admin
      .from("booking_bookings")
      .update({ paid: true })
      .eq("id", intent.metadata.local_booking_id);
    if (bookingUpdate.error) throw bookingUpdate.error;
  }
}

async function syncCompletedCheckoutSession(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const admin = supabase as any;
  const localCustomerId = session.metadata?.local_customer_id;

  if (session.mode === "setup") {
    if (!localCustomerId || typeof session.customer !== "string" || typeof session.setup_intent !== "string") return;

    const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent);
    const paymentMethodId =
      typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : null;

    if (!paymentMethodId) return;

    await stripe.customers.update(session.customer, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const updateResult = await admin
      .from("booking_customers")
      .update({
        stripe_customer_id: session.customer,
        stripe_default_payment_method_id: paymentMethodId,
      })
      .eq("id", localCustomerId);

    if (updateResult.error) throw updateResult.error;
  }

  if (session.mode === "payment" && typeof session.payment_intent === "string") {
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
    await upsertPaymentIntentRecord(supabase, stripe, intent);
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = normalizeStripeKey(process.env.STRIPE_WEBHOOK_SECRET);

  if (!signature || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Missing Stripe webhook configuration." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
        await syncCompletedCheckoutSession(supabase, stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
        await upsertPaymentIntentRecord(supabase, stripe, event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Webhook failed." },
      { status: 400 }
    );
  }
}
