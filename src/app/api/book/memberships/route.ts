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
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
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

function stripeIntervalForBillingPeriod(billingPeriod: string): "week" | "month" | "year" {
  if (billingPeriod === "Weekly") return "week";
  if (billingPeriod === "Yearly") return "year";
  return "month";
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
      ? await supabase.from("booking_customers").select("id").eq("id", submittedCustomerId).maybeSingle()
      : await supabase
          .from("booking_customers")
          .select("id")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

    if (customerLookup.error) throw customerLookup.error;

    let customerId = (customerLookup.data as { id?: string } | null)?.id;

    if (customerId) {
      const updateResult = await supabase
        .from("booking_customers")
        .update({
          parent_name: parentName,
          player_name: playerName,
          email,
          phone,
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
    const priceCents = Math.round(Number(service.price || 0) * 100);
    const creditsPerDay = Math.max(0, Math.floor(Number(service.membership_credits_per_day ?? 0)));
    const creditLimitPeriod = normalizeCreditLimitPeriod(service.membership_credit_limit_period);
    const creditScope = normalizeCreditScope(service.membership_credit_scope);
    const eligibleServiceIds = stringArray(service.membership_eligible_service_ids);
    const stripePriceId = clean(service.stripe_price_id);

    if (priceCents > 0) {
      const stripe = getStripe();
      const customer = await getBillingCustomerRecord(supabase, customerId);
      const stripeCustomerId = await ensureStripeCustomerForBookingCustomer(supabase, stripe, customer);
      const origin = new URL(req.url).origin;
      const lineItem = stripePriceId
        ? { price: stripePriceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              unit_amount: priceCents,
              recurring: { interval: stripeIntervalForBillingPeriod(billingPeriod) },
              product_data: {
                name: clean(service.name) || "Membership",
                metadata: {
                  local_membership_service_id: serviceId,
                },
              },
            },
            quantity: 1,
          };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [lineItem],
        metadata: {
          local_customer_id: customerId,
          membership_service_id: serviceId,
          membership_origin: "public_booking_page",
        },
        subscription_data: {
          metadata: {
            local_customer_id: customerId,
            membership_service_id: serviceId,
            membership_origin: "public_booking_page",
          },
        },
        success_url: `${origin}/book?membership=success`,
        cancel_url: `${origin}/book?membership=cancelled`,
      });

      if (!session.url) throw new Error("Stripe did not return a checkout URL.");

      return NextResponse.json({
        ok: true,
        requiresCheckout: true,
        url: session.url,
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
      requiresCheckout: false,
      membershipId: (membershipResult.data as { id: string }).id,
      customerId,
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not start membership purchase.", 500);
  }
}
