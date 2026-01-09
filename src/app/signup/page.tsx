"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function clean(v: string) {
  return v.trim();
}

function fullName(first: string, last: string) {
  return [clean(first), clean(last)].filter(Boolean).join(" ").trim();
}

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!clean(firstName)) return false;
    if (!clean(lastName)) return false;
    if (!clean(email)) return false;
    if (clean(password).length < 8) return false;
    return true;
  }, [firstName, lastName, email, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setStatus(null);
    setLoading(true);

    const fn = clean(firstName);
    const ln = clean(lastName);
    const em = clean(email).toLowerCase();
    const pw = password;

    const meta = {
      first_name: fn,
      last_name: ln,
      full_name: fullName(fn, ln),
      phone: clean(phone),
      address: clean(address),
    };

    try {
      // 1) Create auth account AND store the info in user_metadata
      // (This is a safe backup even if profile insert happens later.)
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password: pw,
        options: { data: meta },
      });

      if (error) {
        setStatus(error.message || "Sign up failed.");
        setLoading(false);
        return;
      }

      const user = data.user;

      // 2) If we have a session right away, we are logged in right away.
      // Then we can upsert into profiles immediately.
      if (data.session && user?.id) {
        const { error: upsertErr } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            first_name: meta.first_name,
            last_name: meta.last_name,
            full_name: meta.full_name,
            phone: meta.phone,
            address: meta.address,
          },
          { onConflict: "id" }
        );

        if (upsertErr) {
          // Account is created, but profile write failed.
          // We'll still continue — the name is also saved in Auth metadata.
          console.error(upsertErr);
          setStatus(
            "Account created, but we could not save your profile details yet. Please log in again, or tell Jason to check the database permissions."
          );
        }

        setLoading(false);
        router.push("/dashboard");
        return;
      }

      // 3) If email confirmation is ON, Supabase may not create a session immediately.
      // In that case, we can’t write to profiles yet (no login), but metadata is saved.
      setLoading(false);
      setStatus(
        "Account created! Check your email to confirm, then log in."
      );
      router.push("/login");
    } catch (err: any) {
      console.error(err);
      setStatus("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="mt-1 text-sm text-black/60">
            Make a login so you can access member features later.
          </p>

          {status ? (
            <div className="mt-4 rounded-xl border border-black/10 bg-black/5 p-3 text-sm text-black">
              {status}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                  placeholder="Jason"
                  autoComplete="given-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                  placeholder="Allaire"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                placeholder="(941) 555-1234"
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                placeholder="123 Main St, Venice, FL"
                autoComplete="street-address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                placeholder="you@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-black"
                placeholder="********"
                autoComplete="new-password"
              />
              <div className="mt-1 text-xs text-black/60">
                Tip: use 8+ characters.
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-sm text-black/70">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
