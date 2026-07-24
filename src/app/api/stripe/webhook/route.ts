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

function normalizeBillingPeriod(value: unknown) {
  return value === "Weekly" || value === "Yearly" ? value : "Monthly";
}

function normalizeCreditLimitPeriod(value: unknown) {
  return value === "weekly" || value === "monthly" ? value : "daily";
}

function normalizeCreditScope(value: unknown) {
  return value === "all_services" ? "all_services" : "selected_services";
}

function addMembershipPeriod(startIso: string, billingPeriod: string) {
  const date = new Date(startIso);
  if (billingPeriod === "Weekly") date.setDate(date.getDate() + 7);
  else if (billingPeriod === "Yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

async function activateMembershipFromCheckout(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription") return;

  const admin = supabase as any;
  const localCustomerId = session.metadata?.local_customer_id;
  const membershipServiceId = session.metadata?.membership_service_id;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (!localCustomerId || !membershipServiceId || !stripeSubscriptionId) return;

  const existingResult = await admin
    .from("booking_customer_memberships")
    .select("id,status")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (existingResult.error) throw existingResult.error;
  if (existingResult.data) return;

  const serviceResult = await admin
    .from("booking_services")
    .select("id,price,membership_billing_period,membership_credits_per_day,membership_credit_limit_period,membership_credit_scope,membership_eligible_service_ids,stripe_price_id")
    .eq("id", membershipServiceId)
    .maybeSingle();

  if (serviceResult.error) throw serviceResult.error;
  if (!serviceResult.data) return;

  const service = serviceResult.data as Record<string, unknown>;
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const subscriptionSource = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  const billingPeriod = normalizeBillingPeriod(service.membership_billing_period);
  const now = new Date().toISOString();
  const currentPeriodStart = subscriptionSource.current_period_start
    ? new Date(subscriptionSource.current_period_start * 1000).toISOString()
    : now;
  const currentPeriodEnd = subscriptionSource.current_period_end
    ? new Date(subscriptionSource.current_period_end * 1000).toISOString()
    : addMembershipPeriod(currentPeriodStart, billingPeriod);

  const membershipResult = await admin.from("booking_customer_memberships").insert({
    customer_id: localCustomerId,
    membership_service_id: membershipServiceId,
    status: "Active",
    billing_period: billingPeriod,
    price_cents: Math.round(Number(service.price || 0) * 100),
    credits_per_day: Math.max(0, Math.floor(Number(service.membership_credits_per_day ?? 0))),
    credit_limit_period: normalizeCreditLimitPeriod(service.membership_credit_limit_period),
    credit_scope: normalizeCreditScope(service.membership_credit_scope),
    eligible_service_ids: stringArray(service.membership_eligible_service_ids),
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: typeof service.stripe_price_id === "string" ? service.stripe_price_id : null,
    auto_renew: true,
    started_at: now,
    cancelled_at: null,
  });

  if (membershipResult.error) throw membershipResult.error;
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

  await activateMembershipFromCheckout(supabase, stripe, session);
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
