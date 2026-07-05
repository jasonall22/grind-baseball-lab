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
