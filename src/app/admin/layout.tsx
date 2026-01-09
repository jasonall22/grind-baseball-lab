"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "member" | "parent" | "coach" | string | null;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [status, setStatus] = useState<"checking" | "allowed" | "denied">(
    "checking"
  );

  useEffect(() => {
    let alive = true;

    async function check() {
      // 1) Must be logged in
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session?.user?.id) {
        setStatus("denied");
        router.replace("/login");
        return;
      }

      // 2) Must be admin in profiles.role
      const userId = session.user.id;

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!alive) return;

      const role: Role = (prof as any)?.role ?? null;

      if (!error && role === "admin") {
        setStatus("allowed");
        return;
      }

      // Not an admin
      setStatus("denied");
      router.replace("/");
    }

    check();

    // If auth changes while on admin pages, re-check
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (status !== "allowed") {
    // Simple, clean gate screen (prevents admin UI flashing for non-admins)
    return (
      <div className="min-h-[70vh] bg-white text-black">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold tracking-[0.18em] text-black/50 uppercase">
              Admin
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">
              Checking access…
            </div>
            <p className="mt-3 text-sm text-black/60">
              You must be logged in as an admin to view this section.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
