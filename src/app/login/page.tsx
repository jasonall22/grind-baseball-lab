"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "grind_member" | "member";

type ProfileRow = {
  id: string;
  role: Role | string | null;
};

const BUILD_TAG = "LOGIN_PAGE_V3_2026-01-12";

function cleanEmail(v: string) {
  return (v ?? "").trim();
}

function isSafeInternalPath(path: string | null | undefined) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
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

  useEffect(() => {
    // Verifies you are running the latest file (no UI change).
    // Check DevTools console for this line.
    // eslint-disable-next-line no-console
    console.log(`[LoginPage] ${BUILD_TAG}`);
  }, []);

  async function getRole(userId: string): Promise<Role> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message || "Could not read your profile role.");

    const role = (data as ProfileRow | null)?.role ?? "member";
    if (role === "admin") return "admin";
    if (role === "grind_member") return "grind_member";
    return "member";
  }

  async function routeAfterLogin(userId: string) {
    // Never allow this to hang forever:
    const role = await withTimeout(getRole(userId), 6000, "Role lookup");

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    if (role === "grind_member") {
      if (nextParam && !nextParam.startsWith("/admin")) {
        router.replace(nextParam);
        return;
      }
      router.replace("/dashboard");
      return;
    }

    if (nextParam && !nextParam.startsWith("/admin") && !nextParam.startsWith("/dashboard")) {
      router.replace(nextParam);
      return;
    }

    router.replace("/");
  }

  // If already logged in, route immediately (and show error if role lookup fails)
  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) {
          setErrorMsg(error.message || "Session error. Please sign in again.");
          return;
        }

        const userId = data.session?.user?.id ?? null;
        if (!userId) return;

        await routeAfterLogin(userId);
      } catch (e: any) {
        if (!alive) return;
        setErrorMsg(e?.message || "Could not route you after login.");
      }
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

    try {
      const em = cleanEmail(email);
      if (!em || !password) {
        setErrorMsg("Please enter your email and password.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: em,
        password,
      });

      if (error || !data.user) {
        setErrorMsg(error?.message ?? "Login failed. Please try again.");
        return;
      }

      // Ensure the session is fully available before routing
      await withTimeout(supabase.auth.getSession(), 4000, "Session sync");

      await routeAfterLogin(data.user.id);
    } catch (e: any) {
      setErrorMsg(e?.message || "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
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
            Admin routes to /admin. GrindMember routes to /dashboard.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
