import { NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomerForBookingCustomer, getBillingCustomerRecord } from "@/lib/stripeCustomers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type PurchaseMembershipBody = {
  serviceId?: string;
  customerId?: string;
  parentName?: string;
  playerName?: string;
  email?: string;
  phone?: string;
  setupIntentId?: string;
  waiverAgreed?: boolean;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parsePrice(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = clean(value).replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeBillingPeriod(value: unknown) {
  return value === "Weekly" || value === "Yearly" ? value : "Monthly";
}

function normalizeCreditLimitPeriod(value: unknown) {
  if (value === "week" || value === "weekly") return "week";
  if (value === "month" || value === "monthly") return "month";
  return "day";
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

function stripeIntervalForBillingPeriod(billingPeriod: string): "week" | "month" | "year" {
  if (billingPeriod === "Weekly") return "week";
  if (billingPeriod === "Yearly") return "year";
  return "month";
}

async function findReusableMembershipSubscription(stripe: ReturnType<typeof getStripe>, stripeCustomerId: string, serviceId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 100,
    expand: ["data.latest_invoice.payment_intent.latest_charge"],
  });

  return subscriptions.data
    .filter((subscription) => {
      if (subscription.metadata.membership_service_id !== serviceId) return false;
      return ["active", "trialing", "past_due", "unpaid"].includes(subscription.status);
    })
    .sort((a, b) => b.created - a.created)[0] ?? null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PurchaseMembershipBody;
    const serviceId = clean(body.serviceId);
    const submittedCustomerId = clean(body.customerId);
    const parentName = clean(body.parentName);
    const playerName = clean(body.playerName);
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);

    if (!serviceId) return badRequest("Choose a membership.");
    if (!parentName || !playerName || !email) {
      return badRequest("Enter the parent name, player name, and email.");
    }

    const supabase = getSupabaseAdmin() as any;
    const settingsResult = await supabase.from("booking_settings").select("waiver_enabled").eq("key", "default").maybeSingle();
    if (settingsResult.error) throw settingsResult.error;
    const waiverRequired = Boolean(settingsResult.data?.waiver_enabled);

    const serviceResult = await supabase
      .from("booking_services")
      .select(
        "id,name,service_type,price,membership_billing_period,membership_credits_per_day,membership_credit_limit_period,membership_credit_scope,membership_eligible_service_ids,stripe_price_id,status"
      )
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceResult.error) throw serviceResult.error;
    const service = serviceResult.data as Record<string, unknown> | null;
    if (!service || service.service_type !== "memberships" || service.status !== "Active") {
      return badRequest("That membership is no longer available.", 409);
    }

    const customerLookup = submittedCustomerId
      ? await supabase.from("booking_customers").select("id,waiver_agreed").eq("id", submittedCustomerId).maybeSingle()
      : await supabase
          .from("booking_customers")
          .select("id,waiver_agreed")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    if (customerLookup.error) throw customerLookup.error;

    let customerId = (customerLookup.data as { id?: string; waiver_agreed?: boolean | null } | null)?.id;
    const existingWaiverAgreed = Boolean((customerLookup.data as { waiver_agreed?: boolean | null } | null)?.waiver_agreed);
    if (waiverRequired && !existingWaiverAgreed && body.waiverAgreed !== true) {
      return badRequest("Agree to the liability waiver before purchasing this membership.");
    }

    if (customerId) {
      const updateResult = await supabase
        .from("booking_customers")
        .update({
          parent_name: parentName,
          player_name: playerName,
          email,
          phone,
          ...(body.waiverAgreed === true ? { waiver_agreed: true } : {}),
        })
        .eq("id", customerId);
      if (updateResult.error) throw updateResult.error;
    } else {
      const customerResult = await supabase
        .from("booking_customers")
        .insert({
          parent_name: parentName,
          player_name: playerName,
          email,
          phone,
          waiver_agreed: Boolean(body.waiverAgreed),
          notes: "Created from public membership checkout.",
        })
        .select("id")
        .single();

      if (customerResult.error) throw customerResult.error;
      customerId = (customerResult.data as { id: string }).id;
    }

    const existingMembershipResult = await supabase
      .from("booking_customer_memberships")
      .select("id,status")
      .eq("customer_id", customerId)
      .eq("membership_service_id", serviceId);

    if (existingMembershipResult.error) throw existingMembershipResult.error;
    const existingActive = ((existingMembershipResult.data ?? []) as Array<{ id?: string; status?: string }>).find((membership) =>
      ["Active", "Paused", "Past Due"].includes(String(membership.status))
    );

    if (existingActive) return badRequest("This membership is already active for this customer.", 409);

    const now = new Date().toISOString();
    const billingPeriod = normalizeBillingPeriod(service.membership_billing_period);
    const priceCents = Math.round(parsePrice(service.price) * 100);
    const creditsPerDay = Math.max(0, Math.floor(Number(service.membership_credits_per_day ?? 0)));
    const creditLimitPeriod = normalizeCreditLimitPeriod(service.membership_credit_limit_period);
    const creditScope = normalizeCreditScope(service.membership_credit_scope);
    const eligibleServiceIds = stringArray(service.membership_eligible_service_ids);
    const stripePriceId = clean(service.stripe_price_id);

    if (priceCents > 0) {
      const stripe = getStripe();
      const customer = await getBillingCustomerRecord(supabase, customerId);
      const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);
      let effectiveStripePriceId = stripePriceId;
      if (!effectiveStripePriceId) {
        const product = await stripe.products.create({
          name: clean(service.name) || "Membership",
          metadata: {
            local_membership_service_id: serviceId,
          },
        });
        const price = await stripe.prices.create({
          currency: "usd",
          unit_amount: priceCents,
          recurring: { interval: stripeIntervalForBillingPeriod(billingPeriod) },
          product: product.id,
          metadata: {
            local_membership_service_id: serviceId,
          },
        });
        effectiveStripePriceId = price.id;

        await supabase.from("booking_services").update({ stripe_price_id: effectiveStripePriceId }).eq("id", serviceId);
      }

      if (!body.setupIntentId) {
        const setupIntent = await stripe.setupIntents.create({
          customer: stripeCustomerId,
          payment_method_types: ["card"],
          usage: "off_session",
          metadata: {
            local_customer_id: customerId,
            membership_service_id: serviceId,
            membership_origin: "public_booking_page",
          },
        });

        if (!setupIntent.client_secret) {
          throw new Error("Stripe did not return a client secret.");
        }

        return NextResponse.json({
          ok: true,
          requiresCard: true,
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
          customerId,
        });
      }

      const setupIntent = await stripe.setupIntents.retrieve(clean(body.setupIntentId));
      if (setupIntent.status !== "succeeded") {
        return badRequest("Card setup is not complete yet.", 409);
      }
      if (typeof setupIntent.customer === "string" && setupIntent.customer !== stripeCustomerId) {
        return badRequest("That card setup does not belong to this customer.", 403);
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
      if (!paymentMethodId) {
        return badRequest("Stripe did not return a saved payment method.", 409);
      }

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      const savedCardResult = await supabase
        .from("booking_customers")
        .update({
          stripe_customer_id: stripeCustomerId,
          stripe_default_payment_method_id: paymentMethodId,
        })
        .eq("id", customerId);
      if (savedCardResult.error) throw savedCardResult.error;

      const subscription =
        (await findReusableMembershipSubscription(stripe, stripeCustomerId, serviceId)) ??
        (await stripe.subscriptions.create({
          customer: stripeCustomerId,
          default_payment_method: paymentMethodId,
          items: [{ price: effectiveStripePriceId, quantity: 1 }],
          payment_behavior: "error_if_incomplete",
          metadata: {
            local_customer_id: customerId,
            membership_service_id: serviceId,
            membership_origin: "public_booking_page",
          },
          expand: ["latest_invoice.payment_intent.latest_charge"],
        }));

      const subscriptionSource = subscription as unknown as { current_period_start?: number; current_period_end?: number };
      const currentPeriodStart = subscriptionSource.current_period_start
        ? new Date(subscriptionSource.current_period_start * 1000).toISOString()
        : now;
      const currentPeriodEnd = subscriptionSource.current_period_end
        ? new Date(subscriptionSource.current_period_end * 1000).toISOString()
        : addMembershipPeriod(currentPeriodStart, billingPeriod);
      const subscriptionPriceId = subscription.items.data[0]?.price?.id ?? effectiveStripePriceId ?? null;

      const membershipResult = await supabase
        .from("booking_customer_memberships")
        .insert({
          customer_id: customerId,
          membership_service_id: serviceId,
          status: "Active",
          billing_period: billingPeriod,
          price_cents: priceCents,
          credits_per_day: creditsPerDay,
          credit_limit_period: creditLimitPeriod,
          credit_scope: creditScope,
          eligible_service_ids: eligibleServiceIds,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscriptionPriceId,
          auto_renew: true,
          started_at: now,
          cancelled_at: null,
        })
        .select("id")
        .single();

      if (membershipResult.error) throw membershipResult.error;

      const latestInvoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
      const paymentIntent =
        latestInvoice && "payment_intent" in latestInvoice && typeof latestInvoice.payment_intent === "object"
          ? latestInvoice.payment_intent
          : null;
      const latestCharge =
        paymentIntent && "latest_charge" in paymentIntent && typeof paymentIntent.latest_charge === "object"
          ? paymentIntent.latest_charge
          : null;
      const paymentRecord = paymentIntent as {
        id?: string;
        amount_received?: number;
        amount?: number;
        currency?: string;
      } | null;
      const chargeRecord = latestCharge as {
        payment_method_details?: { card?: { brand?: string | null; last4?: string | null } };
        receipt_url?: string | null;
      } | null;

      if (paymentRecord?.id) {
        const paymentResult = await supabase.from("booking_customer_payments").upsert(
          {
            customer_id: customerId,
            booking_id: null,
            stripe_payment_intent_id: paymentRecord.id,
            amount_cents: paymentRecord.amount_received || paymentRecord.amount || priceCents,
            currency: paymentRecord.currency || "usd",
            status: "Succeeded",
            description: `${clean(service.name) || "Membership"} membership`,
            payment_method_brand: chargeRecord?.payment_method_details?.card?.brand ?? null,
            payment_method_last4: chargeRecord?.payment_method_details?.card?.last4 ?? null,
            receipt_url: chargeRecord?.receipt_url ?? null,
            processed_at: now,
          },
          { onConflict: "stripe_payment_intent_id" }
        );

        if (paymentResult.error) throw paymentResult.error;
      }

      return NextResponse.json({
        ok: true,
        requiresCard: false,
        membershipId: (membershipResult.data as { id: string }).id,
        customerId,
      });
    }

    const membershipResult = await supabase
      .from("booking_customer_memberships")
      .insert({
        customer_id: customerId,
        membership_service_id: serviceId,
        status: "Active",
        billing_period: billingPeriod,
        price_cents: priceCents,
        credits_per_day: creditsPerDay,
        credit_limit_period: creditLimitPeriod,
        credit_scope: creditScope,
        eligible_service_ids: eligibleServiceIds,
        current_period_start: now,
        current_period_end: addMembershipPeriod(now, billingPeriod),
        stripe_subscription_id: null,
        stripe_price_id: null,
        auto_renew: false,
        started_at: now,
        cancelled_at: null,
      })
      .select("id")
      .single();

    if (membershipResult.error) throw membershipResult.error;

    return NextResponse.json({
      ok: true,
      requiresCard: false,
      membershipId: (membershipResult.data as { id: string }).id,
      customerId,
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not start membership purchase.", 500);
  }
}
