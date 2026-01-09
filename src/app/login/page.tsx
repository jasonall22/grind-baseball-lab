"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white text-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <p className="text-sm text-black/60 mt-1">
          Use your email and password to log in.
        </p>

        {message ? (
          <div className="mt-4 rounded-xl bg-black/5 border border-black/10 p-3 text-sm">
            {message}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:ring-2 focus:ring-black/15"
              placeholder="you@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-black/15 px-3 py-2 outline-none focus:ring-2 focus:ring-black/15"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-2.5 font-medium disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="mt-4 text-sm text-black/70">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
