"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  role: "admin" | "member" | "parent" | "coach" | string | null;
};

function cleanEmail(v: string) {
  return v.trim();
}

function isSafeInternalPath(path: string | null | undefined) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  // prevent open-redirect-like values
  if (path.startsWith("//")) return false;
  return true;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const nextParam = useMemo(() => {
    const raw = searchParams.get("next");
    return isSafeInternalPath(raw) ? raw : null;
  }, [searchParams]);

  async function getRole(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    return (data as ProfileRow | null)?.role ?? null;
  }

  async function routeAfterLogin(userId: string) {
    const role = await getRole(userId);

    // ✅ Requested behavior:
    // - Admin -> /admin
    // - Everyone else -> homepage
    if ((role ?? "") === "admin") {
      router.push("/admin");
      return;
    }

    // If next param exists (like /pricing), allow it for non-admin users too
    // but never auto-send non-admin into /admin
    if (nextParam && !nextParam.startsWith("/admin")) {
      router.push(nextParam);
      return;
    }

    router.push("/");
  }

  // If already logged in, route immediately
  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!alive) return;

      const userId = session?.user?.id ?? null;
      if (!userId) return;

      await routeAfterLogin(userId);
    }

    void boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setErrorMsg(null);

    const em = cleanEmail(email);
    if (!em || !password) {
      setErrorMsg("Please enter your email and password.");
      setBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: em,
      password,
    });

    if (error || !data.user) {
      setErrorMsg(error?.message ?? "Login failed. Please try again.");
      setBusy(false);
      return;
    }

    await routeAfterLogin(data.user.id);
    setBusy(false);
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-white text-black">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="text-[11px] font-semibold tracking-[0.28em] text-black/55">
              THE GRIND BASEBALL LAB
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-black/60">
              Access your account and manage bookings.
            </p>
          </div>

          {errorMsg ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold tracking-wide text-black/70">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/35"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide text-black/70">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/35"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className={
                "mt-2 w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition " +
                (busy ? "opacity-70" : "hover:bg-[#1FA2FF]")
              }
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>

            <div className="pt-2 text-center text-sm text-black/70">
              Don’t have an account?{" "}
              <a href="/signup" className="font-semibold underline underline-offset-4">
                Create one
              </a>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-black/45">
            Admin accounts route to the Admin Dashboard automatically.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // ✅ Fix for Vercel build:
  // useSearchParams is inside LoginInner, wrapped by Suspense here.
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-120px)] bg-white">
          <div className="mx-auto max-w-md px-4 py-16">
            <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
              <div className="h-4 w-40 rounded bg-black/10" />
              <div className="mt-4 h-10 w-3/4 rounded bg-black/10" />
              <div className="mt-6 h-11 w-full rounded-2xl bg-black/10" />
              <div className="mt-3 h-11 w-full rounded-2xl bg-black/10" />
              <div className="mt-6 h-12 w-full rounded-full bg-black/10" />
            </div>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
