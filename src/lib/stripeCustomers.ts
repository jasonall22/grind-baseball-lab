import type Stripe from "stripe";

type BillingCustomerRecord = {
  id: string;
  parent_name: string;
  player_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  stripe_customer_id: string | null;
  stripe_default_payment_method_id: string | null;
};

type BillingSupabaseClient = {
  from: (table: string) => any;
};

export async function getBillingCustomerRecord(
  supabase: BillingSupabaseClient,
  customerId: string
) {
  const result = await supabase
    .from("booking_customers")
    .select(
      "id, parent_name, player_name, email, phone, address, stripe_customer_id, stripe_default_payment_method_id"
    )
    .eq("id", customerId)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) throw new Error("Customer not found.");

  return result.data;
}

export async function ensureStripeCustomerForBookingCustomer(
  supabase: BillingSupabaseClient,
  stripe: Stripe,
  customer: BillingCustomerRecord
) {
  if (customer.stripe_customer_id) {
    return customer.stripe_customer_id;
  }

  const stripeCustomer = await stripe.customers.create({
    name: customer.parent_name || customer.player_name || "Booking Customer",
    email: customer.email || undefined,
    phone: customer.phone || undefined,
    address: customer.address ? { line1: customer.address } : undefined,
    metadata: {
      local_customer_id: customer.id,
      player_name: customer.player_name || "",
    },
  });

  const updateResult = await supabase
    .from("booking_customers")
    .update({ stripe_customer_id: stripeCustomer.id })
    .eq("id", customer.id);

  if (updateResult.error) throw updateResult.error;

  return stripeCustomer.id;
}
