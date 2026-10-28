import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/serverSupabase";
import AdminNavigation from "@/components/admin/AdminNavigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") redirect("/");
  return <div className="min-h-screen bg-white text-black"><AdminNavigation />{children}</div>;
}
