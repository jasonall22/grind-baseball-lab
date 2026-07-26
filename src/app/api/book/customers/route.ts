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
  update(values: unknown): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
};
type AuthAdminResult = {
  data: { user?: { id: string } | null };
  error: QueryError;
};
type AuthUserResult = {
  data: { user?: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null };
  error: QueryError;
};
type CustomerSupabaseClient = {
  from(table: string): QueryBuilder;
  auth: {
    getUser(jwt: string): Promise<AuthUserResult>;
    admin: {
      createUser(args: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata?: Record<string, string>;
      }): Promise<AuthAdminResult>;
    };
  };
};

type CreateCustomerBody = {
  parentFirstName?: string;
  parentLastName?: string;
  parentName?: string;
  playerFirstName?: string;
  playerLastName?: string;
  playerName?: string;
  playerAge?: string;
  email?: string;
  phone?: string;
  password?: string;
  familyMembers?: unknown;
  waiverAgreed?: boolean;
};
type UpdateCustomerBody = {
  familyMembers?: unknown;
  waiverAgreed?: boolean;
};
type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  age: string;
};
type CustomerDashboardResponse = {
  upcomingBookings: Array<Record<string, unknown>>;
  pastBookings: Array<Record<string, unknown>>;
  memberships: Array<Record<string, unknown>>;
  membershipHistory: Array<Record<string, unknown>>;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parsePrice(value: unknown) {
  const amount = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function emptyDashboard(): CustomerDashboardResponse {
  return { upcomingBookings: [], pastBookings: [], memberships: [], membershipHistory: [] };
}

function isExistingUserError(error: QueryError) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("already registered") || message.includes("already been registered") || message.includes("already exists");
}

function normalizeFamilyMembers(value: unknown): FamilyMember[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const firstName = clean(record.firstName);
      const lastName = clean(record.lastName);
      const name = clean(record.name) || [firstName, lastName].filter(Boolean).join(" ").trim();
      if (!name) return null;

      return {
        id: clean(record.id) || `player-${Date.now()}-${index}`,
        firstName: firstName || name.split(" ")[0] || name,
        lastName: lastName || name.split(" ").slice(1).join(" "),
        name,
        age: clean(record.age),
      };
    })
    .filter((item): item is FamilyMember => Boolean(item));
}

async function waiverIsRequired(supabase: CustomerSupabaseClient) {
  const settingsResult = await supabase.from("booking_settings").select("waiver_enabled").eq("key", "default").maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  return Boolean((settingsResult.data as { waiver_enabled?: boolean } | null)?.waiver_enabled);
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return badRequest("Sign in to load your account.", 401);

    const supabase = getSupabaseAdmin() as unknown as CustomerSupabaseClient;
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) return badRequest("Sign in to load your account.", 401);

    const user = userResult.data.user;
    const email = clean(user.email).toLowerCase();
    const customerResult = await supabase
      .from("booking_customers")
      .select("id,parent_name,player_name,email,phone,age,family_members,waiver_agreed")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;

    const customer = customerResult.data as
      | {
          id?: string;
          parent_name?: string;
          player_name?: string;
          email?: string;
          phone?: string;
          age?: number | null;
          family_members?: unknown;
          waiver_agreed?: boolean | null;
        }
      | null;
    const metadata = user.user_metadata ?? {};
    const metadataName = clean(metadata.full_name);
    let dashboard = emptyDashboard();

    if (customer?.id) {
      const [bookingsResult, membershipsResult, servicesResult, resourcesResult, staffResult, paymentsResult] = await Promise.all([
        supabase
          .from("booking_bookings")
          .select("id,booking_date,start_time,end_time,status,paid,service_id,resource_id,staff_member_id,player_name")
          .eq("customer_id", customer.id)
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: false })
          .limit(40),
        supabase
          .from("booking_customer_memberships")
          .select("id,membership_service_id,status,billing_period,price_cents,credits_per_day,credit_limit_period,current_period_start,current_period_end,auto_renew,started_at,cancelled_at,created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("booking_services").select("id,name,service_type,price"),
        supabase.from("booking_resources").select("id,name"),
        supabase.from("booking_staff_members").select("id,full_name"),
        supabase
          .from("booking_customer_payments")
          .select("id,amount_cents,status,description,receipt_url,payment_method_brand,payment_method_last4,processed_at,created_at")
          .eq("customer_id", customer.id)
          .order("processed_at", { ascending: false })
          .limit(40),
      ]);

      const failed = [bookingsResult, membershipsResult, servicesResult, resourcesResult, staffResult, paymentsResult].find((result) => result.error);
      if (failed?.error) throw failed.error;

      const servicesById = new Map(
        ((servicesResult.data ?? []) as Array<Record<string, unknown>>).map((service) => [
          String(service.id),
          {
            name: clean(service.name),
            category: clean(service.service_type),
            priceCents: Math.round(parsePrice(service.price) * 100),
          },
        ])
      );
      const resourcesById = new Map(((resourcesResult.data ?? []) as Array<Record<string, unknown>>).map((resource) => [String(resource.id), clean(resource.name)]));
      const staffById = new Map(((staffResult.data ?? []) as Array<Record<string, unknown>>).map((staff) => [String(staff.id), clean(staff.full_name)]));
      const payments = ((paymentsResult.data ?? []) as Array<Record<string, unknown>>).map((payment) => ({
        id: String(payment.id),
        amountCents: Number(payment.amount_cents ?? 0),
        status: clean(payment.status),
        description: clean(payment.description),
        receiptUrl: clean(payment.receipt_url),
        paymentMethodBrand: clean(payment.payment_method_brand),
        paymentMethodLast4: clean(payment.payment_method_last4),
        processedAt: clean(payment.processed_at),
        createdAt: clean(payment.created_at),
      }));
      const cancelRequestsByMembershipId = new Map<string, Record<string, string>>();
      payments
        .filter((payment) => payment.paymentMethodBrand === "Membership cancellation request")
        .forEach((payment) => {
          const membershipId = payment.description.match(/\[membership:([^\]]+)\]/)?.[1] ?? "";
          if (!membershipId || cancelRequestsByMembershipId.has(membershipId)) return;
          cancelRequestsByMembershipId.set(membershipId, {
            id: payment.id,
            status: payment.status === "Cancelled" ? "Completed" : "Pending",
            message: payment.description.replace(/\[membership:[^\]]+\]\s*/g, "").replace(/^Cancellation requested\.?\s*/i, "").trim(),
            requestedAt: payment.processedAt || payment.createdAt,
            reviewedAt: "",
            adminNotes: "",
          });
        });
      const today = new Date().toISOString().slice(0, 10);
      const bookings = ((bookingsResult.data ?? []) as Array<Record<string, unknown>>).map((booking) => {
        const service = servicesById.get(clean(booking.service_id));
        return {
          id: String(booking.id),
          date: clean(booking.booking_date),
          start: clean(booking.start_time),
          end: clean(booking.end_time),
          status: clean(booking.status) || "Pending",
          paid: Boolean(booking.paid),
          serviceName: service?.name || "Booking",
          serviceCategory: service?.category || "",
          resourceName: resourcesById.get(clean(booking.resource_id)) || "",
          staffName: staffById.get(clean(booking.staff_member_id)) || "",
          playerName: clean(booking.player_name),
        };
      });
      const membershipItems = ((membershipsResult.data ?? []) as Array<Record<string, unknown>>).map((membership) => {
        const service = servicesById.get(clean(membership.membership_service_id));
        const membershipName = service?.name || "Membership";
        const membershipNameKey = membershipName.toLowerCase();
        const latestPayment = payments.find((payment) => {
          const description = payment.description.toLowerCase();
          return (
            payment.paymentMethodBrand !== "Membership cancellation request" &&
            ["Succeeded", "Refunded"].includes(payment.status) &&
            (description.includes(membershipNameKey) || description.includes("membership"))
          );
        });
        return {
          id: String(membership.id),
          status: clean(membership.status) || "Active",
          serviceName: membershipName,
          billingPeriod: clean(membership.billing_period) || "Monthly",
          priceCents: Number(membership.price_cents ?? service?.priceCents ?? 0),
          creditsPerDay: Number(membership.credits_per_day ?? 0),
          creditLimitPeriod: clean(membership.credit_limit_period) || "day",
          currentPeriodStart: clean(membership.current_period_start),
          currentPeriodEnd: clean(membership.current_period_end),
          startedAt: clean(membership.started_at) || clean(membership.created_at),
          cancelledAt: clean(membership.cancelled_at),
          autoRenew: Boolean(membership.auto_renew),
          latestReceiptUrl: latestPayment?.receiptUrl ?? "",
          latestPaymentAmountCents: latestPayment?.amountCents ?? 0,
          latestPaymentStatus: latestPayment?.status ?? "",
          latestPaymentDate: latestPayment?.processedAt || latestPayment?.createdAt || "",
          latestPaymentMethod: latestPayment?.paymentMethodBrand
            ? `${latestPayment.paymentMethodBrand}${latestPayment.paymentMethodLast4 ? ` ending ${latestPayment.paymentMethodLast4}` : ""}`
            : "",
          cancelRequest: cancelRequestsByMembershipId.get(String(membership.id)) ?? null,
        };
      });

      dashboard = {
        upcomingBookings: bookings
          .filter((booking) => booking.date >= today && booking.status !== "Cancelled")
          .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)),
        pastBookings: bookings
          .filter((booking) => booking.date < today || booking.status === "Cancelled")
          .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`)),
        memberships: membershipItems.filter((membership) => !["Cancelled", "Expired"].includes(String(membership.status))),
        membershipHistory: membershipItems.filter((membership) => ["Cancelled", "Expired"].includes(String(membership.status))),
      };
    }

    return NextResponse.json({
      ok: true,
      customer: {
        id: customer?.id ?? "",
        parentName: clean(customer?.parent_name) || metadataName || email,
        playerName: clean(customer?.player_name),
        playerAge: customer?.age === null || customer?.age === undefined ? "" : String(customer.age),
        email,
        phone: clean(customer?.phone),
        familyMembers: normalizeFamilyMembers(customer?.family_members),
        waiverAgreed: Boolean(customer?.waiver_agreed),
      },
      dashboard,
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not load parent account.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateCustomerBody;
    const parentFirstName = clean(body.parentFirstName);
    const parentLastName = clean(body.parentLastName);
    const parentName = clean(body.parentName) || [parentFirstName, parentLastName].filter(Boolean).join(" ").trim();
    const playerFirstName = clean(body.playerFirstName);
    const playerLastName = clean(body.playerLastName);
    const playerName = clean(body.playerName) || [playerFirstName, playerLastName].filter(Boolean).join(" ").trim();
    const playerAge = clean(body.playerAge);
    const ageValue = playerAge ? Number.parseInt(playerAge, 10) : null;
    const email = clean(body.email).toLowerCase();
    const phone = clean(body.phone);
    const password = String(body.password ?? "");
    const familyMembers = normalizeFamilyMembers(body.familyMembers);

    if (!parentName) return badRequest("Enter the parent name.");
    if (!playerName) return badRequest("Enter the player name.");
    if (!email || !email.includes("@")) return badRequest("Enter a valid email.");
    if (password.length < 6) return badRequest("Password must be at least 6 characters.");
    if (ageValue !== null && (!Number.isFinite(ageValue) || ageValue < 0)) return badRequest("Enter a valid player age.");

    const supabase = getSupabaseAdmin() as unknown as CustomerSupabaseClient;
    if ((await waiverIsRequired(supabase)) && body.waiverAgreed !== true) {
      return badRequest("Agree to the liability waiver before creating a parent account.");
    }

    const primaryFamilyMember: FamilyMember = {
      id: familyMembers[0]?.id || `player-${Date.now()}`,
      firstName: playerFirstName || playerName.split(" ")[0] || playerName,
      lastName: playerLastName || playerName.split(" ").slice(1).join(" "),
      name: playerName,
      age: playerAge,
    };
    const savedFamilyMembers = familyMembers.length ? familyMembers : [primaryFamilyMember];

    const authResult = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: parentFirstName,
        last_name: parentLastName,
        full_name: parentName,
      },
    });

    if (authResult.error) {
      if (isExistingUserError(authResult.error)) {
        return badRequest("An account with this email already exists. Please sign in.", 409);
      }
      throw authResult.error;
    }

    const userId = authResult.data.user?.id ?? null;
    if (userId) {
      const profileResult = await supabase
        .from("profiles")
        .update({
          first_name: parentFirstName || null,
          last_name: parentLastName || null,
          full_name: parentName,
          role: "parent",
        })
        .eq("id", userId);

      if (profileResult.error) {
        console.error("Parent profile update failed:", profileResult.error);
      }
    }

    const existingCustomer = await supabase
      .from("booking_customers")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingCustomer.error) throw existingCustomer.error;

    const customerPatch = {
      parent_name: parentName,
      player_name: playerName,
      email,
      phone,
      age: ageValue,
      family_members: savedFamilyMembers,
      waiver_agreed: Boolean(body.waiverAgreed),
      notes: "Created from public parent account signup.",
    };

    let customerId = (existingCustomer.data as { id?: string } | null)?.id ?? null;

    if (customerId) {
      const updateResult = await supabase.from("booking_customers").update(customerPatch).eq("id", customerId).select("id").single();
      if (updateResult.error) throw updateResult.error;
      customerId = (updateResult.data as { id: string }).id;
    } else {
      const insertResult = await supabase.from("booking_customers").insert(customerPatch).select("id").single();
      if (insertResult.error) throw insertResult.error;
      customerId = (insertResult.data as { id: string }).id;
    }

    return NextResponse.json({
      ok: true,
      authUserCreated: Boolean(userId),
      customer: {
        id: customerId,
        parentName,
        playerName,
        playerAge,
        email,
        phone,
        familyMembers: savedFamilyMembers,
        waiverAgreed: Boolean(body.waiverAgreed),
      },
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not create parent account.", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return badRequest("Sign in to update your account.", 401);

    const body = (await req.json()) as UpdateCustomerBody;
    const supabase = getSupabaseAdmin() as unknown as CustomerSupabaseClient;
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) return badRequest("Sign in to update your account.", 401);

    const email = clean(userResult.data.user.email).toLowerCase();
    const customerResult = await supabase
      .from("booking_customers")
      .select("id,family_members,waiver_agreed")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;
    const customer = customerResult.data as { id?: string; family_members?: unknown; waiver_agreed?: boolean | null } | null;
    if (!customer?.id) return badRequest("Could not find your family account.", 404);

    const patch: Record<string, unknown> = {};
    if (body.familyMembers !== undefined) patch.family_members = normalizeFamilyMembers(body.familyMembers);
    if (body.waiverAgreed === true) patch.waiver_agreed = true;
    if (!Object.keys(patch).length) return badRequest("Nothing to update.");

    const updateResult = await supabase
      .from("booking_customers")
      .update(patch)
      .eq("id", customer.id)
      .select("id,parent_name,player_name,email,phone,age,family_members,waiver_agreed")
      .single();

    if (updateResult.error) throw updateResult.error;
    const updated = updateResult.data as {
      id: string;
      parent_name?: string;
      player_name?: string;
      email?: string;
      phone?: string;
      age?: number | null;
      family_members?: unknown;
      waiver_agreed?: boolean | null;
    };

    return NextResponse.json({
      ok: true,
      customer: {
        id: updated.id,
        parentName: clean(updated.parent_name),
        playerName: clean(updated.player_name),
        playerAge: updated.age === null || updated.age === undefined ? "" : String(updated.age),
        email: clean(updated.email) || email,
        phone: clean(updated.phone),
        familyMembers: normalizeFamilyMembers(updated.family_members),
        waiverAgreed: Boolean(updated.waiver_agreed),
      },
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not update parent account.", 500);
  }
}
