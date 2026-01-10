"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  role: "admin" | "member" | "parent" | "coach" | string | null;
};

function cleanEmail(v: string) {
  return v.trim();
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // optional ?next=/somewhere
  const nextParam = useMemo(() => {
    const n = searchParams?.get("next");
    if (!n) return null;
    // basic safety: only allow internal paths
    if (!n.startsWith("/")) return null;
    return n;
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, route them correctly
  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!alive) return;

      if (!session?.user?.id) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!alive) return;

      const role = (prof as ProfileRow | null)?.role ?? null;

      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      // Non-admin: go to next=... if present, else HOME
      if (nextParam) {
        router.replace(nextParam);
        return;
      }

      router.replace("/");
    }

    void boot();
    return () => {
      alive = false;
    };
  }, [router, nextParam]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      const cleaned = cleanEmail(email);
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleaned,
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        return;
      }

      const userId = data.user?.id ?? null;
      if (!userId) {
        setError("Login failed. Please try again.");
        return;
      }

      // ✅ Admins go straight to /admin
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      const role = (prof as ProfileRow | null)?.role ?? null;

      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      // Non-admin: go to next=... if present, else HOME
      if (nextParam) {
        router.replace(nextParam);
        return;
      }

      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-white text-black">
      <div className="mx-auto max-w-lg px-4 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight">Login</h1>
        <p className="mt-2 text-sm text-black/65">
          Sign in to your account. Admins will be taken to the Admin Dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold tracking-wide text-black/70">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
              placeholder="you@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wide text-black/70">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={
              "w-full rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-none " +
              (busy ? "opacity-60" : "hover:bg-black/90")
            }
          >
            {busy ? "Signing in..." : "Sign In"}
          </button>

          <div className="pt-2 text-sm text-black/70">
            Don’t have an account?{" "}
            <a href="/signup" className="font-semibold underline underline-offset-4">
              Create one
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
