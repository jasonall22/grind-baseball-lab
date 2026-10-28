import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/serverSupabase";
import { getFacebookNews } from "@/lib/getFacebookNews";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const feed = await getFacebookNews();
  return NextResponse.json({ status: feed.status, message: feed.message, postCount: feed.slides.length }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
