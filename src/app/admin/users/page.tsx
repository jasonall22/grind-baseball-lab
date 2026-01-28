"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "member" | "grind_member" | "admin";

type ProfileRow = {
  id: string;
  role: Role | string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function clean(v: string | null | undefined) {
  return (v ?? "").trim();
}

function displayName(p: ProfileRow) {
  const fn = clean(p.first_name);
  const ln = clean(p.last_name);
  const full = clean(p.full_name);

  if (fn || ln) return [fn, ln].filter(Boolean).join(" ").trim();
  if (full) return full;
  return p.id;
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string>("");

  const [meRole, setMeRole] = useState<Role | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setChecking(true);
      setError("");

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const prof = await supabase
        .from("profiles")
        .select("id, role, full_name, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

      const role = ((prof.data as any)?.role ?? null) as Role | null;

      if (!role || role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (!alive) return;

      setMeRole(role);
      setChecking(false);

      await loadProfiles();
    }

    boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfiles() {
    setLoading(true);
    setError("");

    const res = await supabase
      .from("profiles")
      .select("id, role, full_name, first_name, last_name")
      .order("full_name", { ascending: true });

    if (res.error) {
      setError(res.error.message || "Could not load users.");
      setProfiles([]);
      setLoading(false);
      return;
    }

    setProfiles((res.data || []) as ProfileRow[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = clean(query).toLowerCase();
    if (!q) return profiles;

    return profiles.filter((p) => {
      const name = displayName(p).toLowerCase();
      const role = clean(p.role as any).toLowerCase();
      return name.includes(q) || role.includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [profiles, query]);

  async function setRole(profileId: string, role: Role) {
    setSavingId(profileId);
    setError("");

    // Force a return row; if 0 rows come back, RLS blocked it
    const res = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", profileId)
      .select("id");

    if ((res as any).error) {
      setError((res as any).error?.message || "Could not update role.");
      setSavingId(null);
      return;
    }

    const rows = ((res as any).data || []) as Array<{ id: string }>;
    if (!rows.length) {
      setError(
        "Role was not updated. This usually means RLS blocked the update. Make sure your profiles UPDATE policy allows admins to update user roles."
      );
      setSavingId(null);
      return;
    }

    await loadProfiles();
    setSavingId(null);
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-black">Users (Admin)</h1>
            <p className="mt-1 text-sm text-black/60">
              Set roles: member, grind_member, admin.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
          >
            Back to Admin
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-black/10 bg-[#f7f8fb] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold tracking-[0.22em] text-black/60 uppercase">
              All Users
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, role, or id…"
              className="w-full sm:w-[340px] rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black outline-none focus:border-black/25"
            />
          </div>

          {checking ? (
            <div className="mt-6 text-sm text-black/60">Checking admin…</div>
          ) : null}

          {!checking && meRole !== "admin" ? (
            <div className="mt-6 text-sm text-black/60">Not authorized.</div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-black/60">Loading users…</div>
          ) : null}

          {!loading ? (
            <div className="mt-6 space-y-3">
              {filtered.length === 0 ? (
                <div className="text-sm text-black/60">No users found.</div>
              ) : null}

              {filtered.map((p) => {
                const name = displayName(p);
                const role = (p.role ?? "member") as any;
                const isSaving = savingId === p.id;

                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-black/10 bg-white px-4 py-4"
                  >
                    <div>
                      <div className="text-sm font-semibold text-black">{name}</div>
                      <div className="mt-1 text-xs text-black/50">{p.id}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-black/50">Role</span>
                      <select
                        value={role}
                        disabled={isSaving}
                        onChange={(e) => setRole(p.id, e.target.value as Role)}
                        className={classNames(
                          "rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black outline-none",
                          isSaving ? "opacity-60" : "hover:bg-black/5"
                        )}
                      >
                        <option value="member">member</option>
                        <option value="grind_member">grind_member</option>
                        <option value="admin">admin</option>
                      </select>

                      {isSaving ? (
                        <span className="text-xs text-black/45">Saving…</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-10 h-px w-full bg-black/10" />
      </div>
    </main>
  );
}
