"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "grind_member" | "member";

type ProfileRow = {
  id: string;
  role: Role | string | null;
};

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRoleAndAccess(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message || "Could not read profile role.");

    const r = ((data as ProfileRow | null)?.role ?? "member") as Role;

    if (r === "admin") return "admin";
    if (r === "grind_member") return "grind_member";
    return "member";
  }

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          setError(error.message || "Session error. Please sign in again.");
          setLoading(false);
          return;
        }

        const session = data.session;
        const user = session?.user ?? null;

        if (!user) {
          router.replace("/login?next=/dashboard");
          return;
        }

        setEmail(user.email ?? null);

        const r = await withTimeout(loadRoleAndAccess(user.id), 6000, "Role lookup");
        if (!mounted) return;

        // ✅ Only GrindMember + Admin can view Dashboard
        if (r !== "admin" && r !== "grind_member") {
          router.replace("/");
          return;
        }

        setRole(r);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Could not load dashboard.");
        setLoading(false);
      }
    }

    void boot();

    // React to sign-in/sign-out changes.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;

      if (!user) {
        router.replace("/login?next=/dashboard");
        return;
      }

      setEmail(user.email ?? null);

      try {
        const r = await withTimeout(loadRoleAndAccess(user.id), 6000, "Role lookup");
        if (r !== "admin" && r !== "grind_member") {
          router.replace("/");
          return;
        }
        setRole(r);
      } catch (_e) {
        // If this fails, fall back to home (safer than leaving a protected page open)
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 p-6">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-black/70">Error: {error}</p>
          <div className="mt-4">
            <Link className="underline text-sm" href="/login">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold">Member Dashboard</h1>
        <p className="mt-2 text-black/65">
          You are logged in as{" "}
          <span className="font-medium">{email ?? "Unknown"}</span>
          {role ? (
            <>
              {" "}
              <span className="text-black/40">•</span>{" "}
              <span className="font-medium">{role === "admin" ? "Admin" : "GrindMember"}</span>
            </>
          ) : null}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={signOut}
            className="rounded-xl bg-black text-white px-4 py-2 font-medium"
          >
            Sign out
          </button>

          <Link
            href="/"
            className="rounded-xl border border-black/15 px-4 py-2 font-medium"
          >
            Back to home
          </Link>
        </div>

        <div className="mt-10 rounded-2xl border border-black/10 p-6">
          <h2 className="text-lg font-semibold">Next steps</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-black/70 space-y-1">
            <li>Admins can promote a user to GrindMember in the Admin Users page.</li>
            <li>We can build the GrindMember dashboard features next (bookings, workouts, metrics).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
