import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// ✅ Health check
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/admin/hero/add" });
}

export async function POST() {
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

    const current = await supabase
      .from("hero_slides")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);

    const maxSort = Number((current.data?.[0] as any)?.sort_order ?? 0);

    const insert = {
      sort_order: maxSort + 1,
      is_active: true,
      headline: "",
      title: "",
      body: "",
      cta_text: "",
      cta_href: "",
      image_url: null as string | null,
    };

    const ins = await supabase
      .from("hero_slides")
      .insert(insert)
      .select("id")
      .single();

    if ((ins as any).error) {
      return jsonError((ins as any).error?.message || "Add slide failed.", 500);
    }

    return NextResponse.json({ ok: true, id: (ins as any).data?.id ?? null });
  } catch (e: any) {
    return jsonError(e?.message || "Server error.", 500);
  }
}
