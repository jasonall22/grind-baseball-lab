import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type SaveBody = {
  id: string;
  payload: Record<string, any>;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// ✅ Health check
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/admin/hero/save" });
}

export async function POST(req: Request) {
  try {
    // ✅ Next.js 15/16: cookies() is async
    const cookieStore = await cookies();

    const supabase = createServerClient(
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

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return jsonError("Not logged in.", 401);

    // Admin check
    const prof = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (prof.data as any)?.role ?? null;
    if (role !== "admin") return jsonError("Not authorized.", 403);

    const body = (await req.json()) as SaveBody;

    if (!body?.id) return jsonError("Missing slide id.");
    if (!body?.payload || typeof body.payload !== "object") return jsonError("Missing payload.");

    const payload: Record<string, any> = { ...body.payload };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    if (!Object.keys(payload).length) {
      return jsonError("No changes to save.");
    }

    const upd = await supabase
      .from("hero_slides")
      .update(payload)
      .eq("id", body.id)
      .select("id");

    if ((upd as any).error) {
      return jsonError((upd as any).error?.message || "Save failed.", 500);
    }

    const rows = ((upd as any).data || []) as Array<{ id: string }>;
    if (!rows.length) {
      return jsonError("Nothing was saved (0 rows). This is usually an RLS policy issue.", 403);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || "Server error.", 500);
  }
}
