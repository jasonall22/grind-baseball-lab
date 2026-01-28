"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "admin" | "grind_member" | "member";

type ProfileRow = {
  id: string;
  role: Role | string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

function clean(v: string) {
  return (v ?? "").trim();
}

function isSafeInternalPath(path: string | null | undefined) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

function formatErr(e: any) {
  if (!e) return "Unknown error.";
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * ✅ IMPORTANT (DB/RLS reality):
 * - The profiles row is created by the auth trigger (handle_new_user).
 * - Normal users usually cannot INSERT into profiles (RLS).
 * - So we MUST UPDATE the existing row after signUp, not UPSERT.
 */
async function updateProfileWithRetry(userId: string, patch: Partial<ProfileRow>) {
  // Retry briefly because the trigger insert can race the first client request
  const attempts = 6;
  const delayMs = 400;

  let lastErr: any = null;

  for (let i = 0; i < attempts; i++) {
    const res = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId);

    if (!res.error) return;

    lastErr = res.error;

    // If row isn't there yet (rare), wait and try again
    await sleep(delayMs);
  }

  throw lastErr ?? new Error("Could not update profile.");
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = useMemo(() => {
    const raw = searchParams.get("next");
    return isSafeInternalPath(raw) ? raw : null;
  }, [searchParams]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // If already logged in, send them home (signup isn't needed)
  useEffect(() => {
    let alive = true;
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session?.user) router.replace("/");
    }
    void boot();
    return () => {
      alive = false;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setStatus(null);

    try {
      const fn = clean(firstName);
      const ln = clean(lastName);
      const em = clean(email).toLowerCase();
      const pw = password;

      if (!em || !pw) {
        setStatus("Please enter your email and password.");
        return;
      }

      const fullName = [fn, ln].filter(Boolean).join(" ").trim();

      // ✅ Create auth user + also store names in auth metadata (useful fallback)
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: {
          data: {
            first_name: fn || undefined,
            last_name: ln || undefined,
            full_name: fullName || undefined,
          },
        },
      });

      if (error) {
        setStatus(error.message || "Could not create account.");
        return;
      }

      const userId = data.user?.id ?? null;

      // If email confirmation is enabled, there may be NO session yet.
      // We still try to save profile names when possible, but we won't block signup if it fails.
      if (userId) {
        try {
          await updateProfileWithRetry(userId, {
            first_name: fn || null,
            last_name: ln || null,
            full_name: fullName || null,
          });
        } catch (profileErr) {
          // Don't fail signup just because profile update failed.
          // Show a helpful message.
          // eslint-disable-next-line no-console
          console.error("Profile update failed:", profileErr);
          setStatus(
            "Account created, but we could not save your profile details yet. Please log in again (or contact admin)."
          );
          // Continue to login page anyway
        }
      }

      // Route: if "next" provided, go to login with next param
      if (nextParam) {
        router.replace(`/login?next=${encodeURIComponent(nextParam)}`);
        return;
      }

      router.replace("/login");
    } catch (err: any) {
      setStatus(formatErr(err));
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
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create account</h1>
            <p className="mt-2 text-sm text-black/60">
              Create your account to access member features.
            </p>
          </div>

          {status ? (
            <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/80">
              {status}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold tracking-wide text-black/70">
                  First name
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  type="text"
                  autoComplete="given-name"
                  className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/35"
                  placeholder="First"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold tracking-wide text-black/70">
                  Last name
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  type="text"
                  autoComplete="family-name"
                  className="mt-2 w-full rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black/35"
                  placeholder="Last"
                />
              </div>
            </div>

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
                autoComplete="new-password"
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
              {busy ? "Creating account..." : "Create account"}
            </button>

            <div className="pt-2 text-center text-sm text-black/70">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-black/45">
            New accounts start as <span className="font-semibold">member</span>. Admin can upgrade to{" "}
            <span className="font-semibold">grind_member</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
