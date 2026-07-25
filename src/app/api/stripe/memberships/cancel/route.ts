import { NextResponse } from "next/server";
import Stripe from "stripe";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type CancelTiming = "immediate" | "period_end";
type ProratedRefundResult = {
  amountCents: number;
  refundId: string;
  receiptUrl: string;
  reason?: string;
};

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function chargeIdForInvoice(stripe: Stripe, invoice: Stripe.Invoice) {
  const invoiceSource = invoice as unknown as {
    charge?: string | Stripe.Charge | null;
    payment_intent?: string | Stripe.PaymentIntent | null;
    payments?: {
      data?: Array<{
        charge?: string | Stripe.Charge | null;
        payment?: {
          charge?: string | Stripe.Charge | null;
        } | null;
      }>;
    };
  };

  const paymentIntent = invoiceSource.payment_intent;
  if (paymentIntent && typeof paymentIntent === "object") {
    const chargeId = stripeObjectId(paymentIntent.latest_charge);
    if (chargeId) return chargeId;
  }

  if (typeof paymentIntent === "string") {
    const retrievedPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent, {
      expand: ["latest_charge"],
    });
    const chargeId = stripeObjectId(retrievedPaymentIntent.latest_charge);
    if (chargeId) return chargeId;
  }

  const invoiceChargeId = stripeObjectId(invoiceSource.charge);
  if (invoiceChargeId) return invoiceChargeId;

  for (const invoicePayment of invoiceSource.payments?.data ?? []) {
    const chargeId = stripeObjectId(invoicePayment.charge) || stripeObjectId(invoicePayment.payment?.charge);
    if (chargeId) return chargeId;
  }

  return "";
}

async function paidInvoiceForSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  const subscriptionSource = subscription as unknown as {
    latest_invoice?: string | Stripe.Invoice | null;
  };
  const latestInvoiceId = stripeObjectId(subscriptionSource.latest_invoice);
  if (latestInvoiceId) {
    const invoice = await stripe.invoices.retrieve(latestInvoiceId, {
      expand: ["payment_intent.latest_charge", "payments"],
    });
    if (invoice.amount_paid > 0) return invoice;
  }

  const invoiceList = await stripe.invoices.list({
    subscription: subscription.id,
    limit: 5,
    expand: ["data.payment_intent.latest_charge", "data.payments"],
  });
  return invoiceList.data.find((invoice) => invoice.amount_paid > 0) ?? null;
}

async function proratedRefundForSubscription(stripe: Stripe, subscription: Stripe.Subscription): Promise<ProratedRefundResult> {
  const subscriptionSource = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const periodStart = Number(subscriptionSource.current_period_start ?? 0);
  const periodEnd = Number(subscriptionSource.current_period_end ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const totalPeriodSeconds = Math.max(0, periodEnd - periodStart);
  const remainingSeconds = clamp(periodEnd - nowSeconds, 0, totalPeriodSeconds);

  if (!totalPeriodSeconds || !remainingSeconds) {
    return { amountCents: 0, refundId: "", receiptUrl: "", reason: "No remaining billable time." };
  }

  const invoice = await paidInvoiceForSubscription(stripe, subscription);
  if (!invoice) return { amountCents: 0, refundId: "", receiptUrl: "", reason: "No paid Stripe invoice was found." };

  const latestChargeId = await chargeIdForInvoice(stripe, invoice);
  if (!latestChargeId) {
    return { amountCents: 0, refundId: "", receiptUrl: "", reason: "No refundable Stripe charge was found." };
  }

  const charge = await stripe.charges.retrieve(latestChargeId);
  const refundableCents = Math.max(0, charge.amount - charge.amount_refunded);
  const basisCents = Math.max(0, Number(invoice.amount_paid ?? charge.amount));
  const proratedCents = Math.floor(basisCents * (remainingSeconds / totalPeriodSeconds));
  const amountCents = Math.min(refundableCents, proratedCents);

  if (amountCents < 1) {
    return {
      amountCents: 0,
      refundId: "",
      receiptUrl: charge.receipt_url ?? "",
      reason: "No refundable prorated amount remained.",
    };
  }

  const refund = await stripe.refunds.create({
    charge: latestChargeId,
    amount: amountCents,
    reason: "requested_by_customer",
    metadata: {
      refund_origin: "admin_membership_cancel",
      subscription_id: subscription.id,
    },
  });

  return {
    amountCents,
    refundId: refund.id,
    receiptUrl: charge.receipt_url ?? "",
  };
}

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const body = (await req.json()) as {
      customerId?: string;
      membershipRecordId?: string;
      timing?: CancelTiming;
      refundProrated?: boolean;
    };
    const customerId = body.customerId?.trim();
    const membershipRecordId = body.membershipRecordId?.trim();
    const timing = body.timing === "period_end" ? "period_end" : "immediate";
    const refundProrated = Boolean(body.refundProrated && timing === "immediate");

    if (!customerId) return routeJsonError("Missing customerId.");
    if (!membershipRecordId) return routeJsonError("Missing membershipRecordId.");

    const membershipResult = await supabase
      .from("booking_customer_memberships")
      .select("*")
      .eq("id", membershipRecordId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (membershipResult.error) throw membershipResult.error;
    if (!membershipResult.data) return routeJsonError("Membership not found.", 404);

    const membership = membershipResult.data as {
      id: string;
      customer_id: string;
      stripe_subscription_id: string | null;
      current_period_end: string | null;
    };
    const now = new Date().toISOString();
    const stripeSubscriptionId = membership.stripe_subscription_id?.trim() || "";
    let refund: ProratedRefundResult | null = null;
    let subscriptionPeriodEnd = membership.current_period_end ?? null;

    if (stripeSubscriptionId) {
      const stripe = getStripe();

      if (timing === "period_end") {
        const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        const subscriptionSource = subscription as unknown as { current_period_end?: number };
        if (subscriptionSource.current_period_end) {
          subscriptionPeriodEnd = new Date(subscriptionSource.current_period_end * 1000).toISOString();
        }
      } else {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
          expand: ["latest_invoice.payment_intent.latest_charge"],
        });

        if (refundProrated) {
          refund = await proratedRefundForSubscription(stripe, subscription);
        }

        await stripe.subscriptions.cancel(stripeSubscriptionId);
      }
    }

    const updatePayload =
      timing === "period_end"
        ? {
            status: "Active",
            auto_renew: false,
            cancelled_at: now,
            current_period_end: subscriptionPeriodEnd,
          }
        : {
            status: "Cancelled",
            auto_renew: false,
            cancelled_at: now,
            current_period_end: now,
          };

    const updateResult = await supabase
      .from("booking_customer_memberships")
      .update(updatePayload)
      .eq("id", membershipRecordId)
      .eq("customer_id", customerId)
      .select("*")
      .single();

    if (updateResult.error) throw updateResult.error;

    const requestUpdate = await supabase
      .from("booking_customer_payments")
      .update({
        status: "Cancelled",
        processed_at: now,
      })
      .eq("customer_id", customerId)
      .eq("payment_method_brand", "Membership cancellation request")
      .eq("status", "Pending")
      .ilike("description", `%[membership:${membershipRecordId}]%`);

    if (requestUpdate.error) throw requestUpdate.error;

    if (refund && refund.amountCents > 0) {
      const refundRecord = await supabase.from("booking_customer_payments").insert({
        customer_id: customerId,
        booking_id: null,
        stripe_payment_intent_id: null,
        stripe_checkout_session_id: null,
        stripe_invoice_id: null,
        amount_cents: refund.amountCents,
        currency: "usd",
        status: "Refunded",
        description: "Prorated membership refund",
        payment_method_brand: "Stripe refund",
        payment_method_last4: null,
        receipt_url: refund.receiptUrl || null,
        processed_at: now,
      });

      if (refundRecord.error) throw refundRecord.error;
    }

    return NextResponse.json({
      ok: true,
      membership: updateResult.data,
      refund,
      timing,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return routeJsonError(error.message || "Stripe could not cancel that membership.", 400);
    }

    return routeJsonError(error instanceof Error ? error.message : "Membership could not be cancelled.", 500);
  }
}
