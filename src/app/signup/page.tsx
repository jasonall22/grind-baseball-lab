// src/app/signup/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
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
  const attempts = 6;
  const delayMs = 400;

  let lastErr: any = null;

  for (let i = 0; i < attempts; i++) {
    const res = await supabase.from("profiles").update(patch).eq("id", userId);

    if (!res.error) return;

    lastErr = res.error;
    await sleep(delayMs);
  }

  throw lastErr ?? new Error("Could not update profile.");
}

/* ======================================================
   INNER PAGE — SAFE TO USE useSearchParams HERE
   ====================================================== */
function SignupInner() {
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

      if (userId) {
        try {
          await updateProfileWithRetry(userId, {
            first_name: fn || null,
            last_name: ln || null,
            full_name: fullName || null,
          });
        } catch (profileErr) {
          console.error("Profile update failed:", profileErr);
          setStatus(
            "Account created, but we could not save your profile details yet. Please log in again (or contact admin)."
          );
        }
      }

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
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="rounded-2xl border border-black/15 px-4 py-3 text-sm"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="rounded-2xl border border-black/15 px-4 py-3 text-sm"
              />
            </div>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-black/15 px-4 py-3 text-sm"
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="w-full rounded-2xl border border-black/15 px-4 py-3 text-sm"
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-black py-3 text-sm font-semibold text-white"
            >
              {busy ? "Creating account..." : "Create account"}
            </button>

            <div className="text-center text-sm">
              <Link href="/login" className="underline">
                Already have an account?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   PAGE WRAPPER — SUSPENSE FIX
   ====================================================== */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
