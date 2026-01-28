import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type DeleteBody = {
  id: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// ✅ Health check
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/admin/hero/delete" });
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

    const prof = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = (prof.data as any)?.role ?? null;
    if (role !== "admin") return jsonError("Not authorized.", 403);

    const body = (await req.json()) as DeleteBody;
    if (!body?.id) return jsonError("Missing slide id.");

    const del = await supabase.from("hero_slides").delete().eq("id", body.id).select("id");

    if ((del as any).error) {
      return jsonError((del as any).error?.message || "Delete failed.", 500);
    }

    const rows = ((del as any).data || []) as Array<{ id: string }>;
    if (!rows.length) {
      return jsonError("Nothing was deleted (0 rows). This is usually an RLS policy issue.", 403);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message || "Server error.", 500);
  }
}
