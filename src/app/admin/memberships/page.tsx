"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "parent" | "coach" | "admin";

type Profile = {
  id: string;
  role: Role | null;
};

type TierRow = {
  id: string;
  sort_order: number;
  title: string | null;
  price_text: string;
  period_text: string;
  note: string | null;
  cta_text: string;
  cta_href: string;
  is_active: boolean;
};

type TierDraft = {
  id: string;
  sort_order: number;
  title: string;
  price_text: string;
  period_text: string;
  note: string;
  cta_text: string;
  cta_href: string;
  is_active: boolean;
};

function toDraft(r: TierRow): TierDraft {
  return {
    id: r.id,
    sort_order: r.sort_order,
    title: r.title ?? "",
    price_text: r.price_text ?? "",
    period_text: r.period_text ?? "",
    note: r.note ?? "",
    cta_text: r.cta_text ?? "",
    cta_href: r.cta_href ?? "",
    is_active: !!r.is_active,
  };
}

export default function AdminMembershipsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [tiers, setTiers] = useState<TierDraft[]>([]);

  const canSave = useMemo(() => tiers.length > 0 && !saving, [tiers.length, saving]);

  useEffect(() => {
    let alive = true;

    async function guardAndLoad() {
      setLoading(true);
      setError(null);

      // 1) Must be logged in
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      // 2) Must be admin
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single<Profile>();

      if (profileErr || !profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      // 3) Load tiers
      const { data, error: tiersErr } = await supabase
        .from("membership_tiers")
        .select("id, sort_order, title, price_text, period_text, note, cta_text, cta_href, is_active")
        .order("sort_order", { ascending: true })
        .limit(12);

      if (!alive) return;

      if (tiersErr) {
        setError("Could not load membership tiers. Did you run the Step 16 SQL in Supabase?");
        setTiers([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as TierRow[];
      setTiers(rows.map(toDraft));
      setLoading(false);
    }

    guardAndLoad();

    return () => {
      alive = false;
    };
  }, [router]);

  function setTier(idx: number, patch: Partial<TierDraft>) {
    setTiers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  async function saveAll() {
    setOk(null);
    setError(null);
    setSaving(true);

    try {
      for (const t of tiers) {
        const payload = {
          sort_order: t.sort_order,
          title: t.title.trim() ? t.title.trim() : null,
          price_text: t.price_text.trim(),
          period_text: t.period_text.trim() || "PER MONTH",
          note: t.note.trim() ? t.note.trim() : null,
          cta_text: t.cta_text.trim() || "Join",
          cta_href: t.cta_href.trim() || "/signup",
          is_active: !!t.is_active,
        };

        const { error: upErr } = await supabase
          .from("membership_tiers")
          .update(payload)
          .eq("id", t.id);

        if (upErr) {
          throw new Error(upErr.message);
        }
      }

      setOk("Saved!");
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
      // Clear “Saved!” after a bit (no animations, just timeout)
      setTimeout(() => setOk(null), 1500);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Membership boxes</h1>
            <p className="mt-2 text-sm text-black/60">
              This controls the text inside the 3 blue boxes on the home page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-full border border-black/15 px-4 py-2 text-sm font-semibold"
            >
              Back
            </button>

            <button
              type="button"
              disabled={!canSave}
              onClick={saveAll}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-black/10 p-6 text-sm text-black/70">
            Loading...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {!loading && ok ? (
          <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {ok}
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {tiers.slice(0, 3).map((t, idx) => (
              <div key={t.id} className="rounded-2xl border border-black/10 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Box #{t.sort_order}</div>
                  <label className="flex items-center gap-2 text-xs text-black/70">
                    <input
                      type="checkbox"
                      checked={t.is_active}
                      onChange={(e) => setTier(idx, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="text-xs font-semibold text-black/70">Title (optional)</label>
                    <input
                      value={t.title}
                      onChange={(e) => setTier(idx, { title: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      placeholder="(optional)"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-black/70">Price</label>
                    <input
                      value={t.price_text}
                      onChange={(e) => setTier(idx, { price_text: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      placeholder="$150"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-black/70">Period</label>
                    <input
                      value={t.period_text}
                      onChange={(e) => setTier(idx, { period_text: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      placeholder="PER MONTH"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-black/70">Small text</label>
                    <textarea
                      value={t.note}
                      onChange={(e) => setTier(idx, { note: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Short sentence under the barcode..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-black/70">Button text</label>
                      <input
                        value={t.cta_text}
                        onChange={(e) => setTier(idx, { cta_text: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                        placeholder="Join"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-black/70">Button link</label>
                      <input
                        value={t.cta_href}
                        onChange={(e) => setTier(idx, { cta_href: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-black/15 px-3 py-2 text-sm"
                        placeholder="/signup"
                      />
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-black/55">
                  Tip: Change the text, then press <b>Save</b>.
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error ? (
          <p className="mt-10 text-sm text-black/60">
            Open your home page in another tab. After you save, refresh the home page to see the changes.
          </p>
        ) : null}
      </div>
    </div>
  );
}
