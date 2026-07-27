"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";

type Role = "admin" | "member" | "parent" | "coach" | string | null;
type ProfileRoleRow = {
  role: Role;
};

type StaffMemberAccessRow = {
  id: string;
  role: string | null;
};

function isBookingAdminPath(pathname: string) {
  return (
    pathname === "/admin/bookings" ||
    pathname === "/admin/home" ||
    pathname === "/admin/services" ||
    pathname.startsWith("/admin/services/") ||
    pathname === "/admin/calendar" ||
    pathname === "/admin/availability" ||
    pathname === "/admin/customers" ||
    pathname.startsWith("/admin/customers/") ||
    pathname === "/admin/marketing" ||
    pathname === "/admin/retail" ||
    pathname === "/admin/reports" ||
    pathname === "/admin/settings" ||
    pathname === "/admin/more"
  );
}

export default function AdminAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<"checking" | "allowed" | "denied">(
    "checking"
  );

  useEffect(() => {
    let alive = true;

    async function check() {
      if (
        process.env.NODE_ENV !== "production" &&
        !hasSupabaseEnv &&
        isBookingAdminPath(pathname)
      ) {
        setStatus("allowed");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session?.user?.id) {
        setStatus("denied");
        router.replace("/book");
        return;
      }

      const userId = session.user.id;
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!alive) return;

      const profile = prof as ProfileRoleRow | null;
      const role: Role = profile?.role ?? null;

      if (!error && (role === "admin" || role === "owner" || role === "staff" || role === "instructor")) {
        setStatus("allowed");
        return;
      }

      if (session.user.email) {
        const { data: staffMember } = await supabase
          .from("booking_staff_members")
          .select("id,role")
          .eq("email", session.user.email)
          .eq("is_active", true)
          .maybeSingle();

        if (!alive) return;

        const staffAccess = staffMember as StaffMemberAccessRow | null;
        if (staffAccess?.id) {
          setStatus("allowed");
          return;
        }
      }

      setStatus("denied");
      router.replace("/");
    }

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (status !== "allowed") {
    return (
      <div className="min-h-[70vh] bg-white text-black">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold tracking-[0.18em] text-black/50 uppercase">
              Admin
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">
              Checking access...
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
