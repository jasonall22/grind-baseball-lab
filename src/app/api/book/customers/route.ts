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
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isExistingUserError(error: QueryError) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("already registered") || message.includes("already been registered") || message.includes("already exists");
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
      .select("id,parent_name,player_name,email,phone,age")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (customerResult.error) throw customerResult.error;

    const customer = customerResult.data as
      | { id?: string; parent_name?: string; player_name?: string; email?: string; phone?: string; age?: number | null }
      | null;
    const metadata = user.user_metadata ?? {};
    const metadataName = clean(metadata.full_name);

    return NextResponse.json({
      ok: true,
      customer: {
        id: customer?.id ?? "",
        parentName: clean(customer?.parent_name) || metadataName || email,
        playerName: clean(customer?.player_name),
        playerAge: customer?.age === null || customer?.age === undefined ? "" : String(customer.age),
        email,
        phone: clean(customer?.phone),
      },
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

    if (!parentName) return badRequest("Enter the parent name.");
    if (!playerName) return badRequest("Enter the player name.");
    if (!email || !email.includes("@")) return badRequest("Enter a valid email.");
    if (password.length < 6) return badRequest("Password must be at least 6 characters.");
    if (ageValue !== null && (!Number.isFinite(ageValue) || ageValue < 0)) return badRequest("Enter a valid player age.");

    const supabase = getSupabaseAdmin() as unknown as CustomerSupabaseClient;
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
      },
    });
  } catch (error) {
    console.error(error);
    return badRequest(error instanceof Error ? error.message : "Could not create parent account.", 500);
  }
}
