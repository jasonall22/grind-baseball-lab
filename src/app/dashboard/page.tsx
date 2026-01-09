"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? null);
      setLoading(false);
    }

    load();

    // Also react to sign-in/sign-out changes.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? null);
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
          You are logged in as <span className="font-medium">{email ?? "Unknown"}</span>
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
            <li>We will add an Admin role + Admin Dashboard.</li>
            <li>We will copy your real Grind site design (header/hero/sections).</li>
            <li>Later: workouts + checkoffs + hitting metrics graphs (we’ll make that perfect).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
