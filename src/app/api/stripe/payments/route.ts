import { NextResponse } from "next/server";

import { requireAdminRouteContext, routeJsonError } from "@/lib/adminRoute";

export async function GET(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const customerId = new URL(req.url).searchParams.get("customerId")?.trim();

    if (!customerId) return routeJsonError("Missing customerId.");

    const result = await supabase
      .from("booking_customer_payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;

    return NextResponse.json({
      ok: true,
      payments: (result.data ?? []).map((payment) => ({
        id: payment.id,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receipt_url,
        paymentMethodBrand: payment.payment_method_brand,
        paymentMethodLast4: payment.payment_method_last4,
        processedAt: payment.processed_at,
        createdAt: payment.created_at,
      })),
    });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not load payments.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireAdminRouteContext();
    if ("error" in context) return context.error;

    const { supabase } = context;
    const body = (await req.json()) as {
      customerId?: string;
      bookingId?: string;
      amount?: number;
      description?: string;
      method?: "cash" | "waive";
    };

    const customerId = body.customerId?.trim();
    const bookingId = body.bookingId?.trim() || null;
    const method = body.method;
    const amountValue = Number(body.amount);
    const description = body.description?.trim() || null;

    if (!customerId) return routeJsonError("Missing customerId.");
    if (method !== "cash" && method !== "waive") {
      return routeJsonError("Unsupported payment method.");
    }
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      return routeJsonError("Enter a valid amount.");
    }

    const customerResult = await supabase
      .from("booking_customers")
      .select("id")
      .eq("id", customerId)
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;
    if (!customerResult.data) return routeJsonError("Customer not found.", 404);

    if (bookingId) {
      const bookingResult = await supabase
        .from("booking_bookings")
        .select("id, customer_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingResult.error) throw bookingResult.error;
      if (!bookingResult.data) return routeJsonError("Booking not found.", 404);
      if (bookingResult.data.customer_id !== customerId) {
        return routeJsonError("Booking does not belong to this customer.", 400);
      }
    }

    const amountCents = Math.round(amountValue * 100);
    const now = new Date().toISOString();
    const paymentMethodBrand = method === "cash" ? "Cash" : "Waived";
    const fallbackDescription = method === "cash" ? "Cash payment" : "Payment waived";

    const insertResult = await supabase
      .from("booking_customer_payments")
      .insert({
        customer_id: customerId,
        booking_id: bookingId,
        amount_cents: amountCents,
        currency: "usd",
        status: "Succeeded",
        description: description || fallbackDescription,
        payment_method_brand: paymentMethodBrand,
        payment_method_last4: null,
        receipt_url: null,
        processed_at: now,
      })
      .select("*")
      .single();

    if (insertResult.error) throw insertResult.error;

    if (bookingId) {
      const bookingUpdate = await supabase
        .from("booking_bookings")
        .update({ paid: true })
        .eq("id", bookingId);

      if (bookingUpdate.error) throw bookingUpdate.error;
    }

    const payment = insertResult.data;
    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        amountCents: payment.amount_cents,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receipt_url,
        paymentMethodBrand: payment.payment_method_brand,
        paymentMethodLast4: payment.payment_method_last4,
        processedAt: payment.processed_at,
        createdAt: payment.created_at,
      },
    });
  } catch (error) {
    console.error(error);
    return routeJsonError(error instanceof Error ? error.message : "Could not save payment.", 500);
  }
}
