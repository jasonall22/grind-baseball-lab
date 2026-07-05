import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export function routeJsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function createRouteSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function requireAdminRouteContext() {
  const supabase = await createRouteSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return { error: routeJsonError("Not logged in.", 401) };
  }

  const profile = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile.data as { role?: string } | null)?.role ?? null;

  if (role !== "admin") {
    return { error: routeJsonError("Not authorized.", 403) };
  }

  return { supabase, user };
}
