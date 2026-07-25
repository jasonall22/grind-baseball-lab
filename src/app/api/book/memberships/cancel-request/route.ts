import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type QueryError = { message?: string } | null;
type QueryResult<T = unknown> = { data: T; error: QueryError };
type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  insert(values: unknown): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type AuthUserResult = {
  data: { user?: { id: string; email?: string } | null };
  error: QueryError;
};
type CancelRequestSupabaseClient = {
  from(table: string): QueryBuilder;
  auth: {
    getUser(jwt: string): Promise<AuthUserResult>;
  };
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonError("Sign in to request a membership cancellation.", 401);

    const body = (await req.json()) as {
      membershipRecordId?: string;
      message?: string;
    };
    const membershipRecordId = clean(body.membershipRecordId);
    const message = clean(body.message);
    if (!membershipRecordId) return jsonError("Choose a membership to request cancellation.");

    const supabase = getSupabaseAdmin() as unknown as CancelRequestSupabaseClient;
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) return jsonError("Sign in to request a membership cancellation.", 401);

    const email = clean(userResult.data.user.email).toLowerCase();
    const customerResult = await supabase
      .from("booking_customers")
      .select("id,email")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;
    const customer = customerResult.data as { id?: string; email?: string } | null;
    if (!customer?.id) return jsonError("Could not find your family account.", 404);

    const membershipResult = await supabase
      .from("booking_customer_memberships")
      .select("id,customer_id,membership_service_id,status,auto_renew")
      .eq("id", membershipRecordId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (membershipResult.error) throw membershipResult.error;
    const membership = membershipResult.data as
      | { id?: string; customer_id?: string; membership_service_id?: string | null; status?: string | null; auto_renew?: boolean | null }
      | null;
    if (!membership?.id) return jsonError("Membership not found.", 404);
    if (clean(membership.status) === "Cancelled" || clean(membership.status) === "Expired") {
      return jsonError("This membership is already inactive.", 409);
    }

    const existingRequest = await supabase
      .from("booking_customer_payments")
      .select("id,status,description,created_at")
      .eq("customer_id", customer.id)
      .eq("payment_method_brand", "Membership cancellation request")
      .eq("status", "Pending")
      .order("created_at", { ascending: false })
      .limit(20);

    if (existingRequest.error) throw existingRequest.error;
    const existingRequestRow = ((existingRequest.data ?? []) as Array<Record<string, unknown>>).find((request) =>
      clean(request.description).includes(`[membership:${membership.id}]`)
    );
    if (existingRequestRow) {
      return NextResponse.json({
        ok: true,
        request: existingRequestRow,
        alreadyPending: true,
      });
    }

    const now = new Date().toISOString();
    const insertResult = await supabase
      .from("booking_customer_payments")
      .insert({
        customer_id: customer.id,
        booking_id: null,
        amount_cents: 0,
        currency: "usd",
        status: "Pending",
        description: `[membership:${membership.id}] Cancellation requested.${message ? ` ${message}` : ""}`,
        payment_method_brand: "Membership cancellation request",
        payment_method_last4: null,
        receipt_url: null,
        processed_at: now,
      })
      .select("id,status,description,processed_at,created_at")
      .single();

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({
      ok: true,
      request: insertResult.data,
      alreadyPending: false,
    });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Could not send cancellation request.", 500);
  }
}
