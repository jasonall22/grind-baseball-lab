"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PricingItem = {
  id: string;
  sort_order: number;
  is_active: boolean;
  name: string;
  duration_minutes: number | null;
  price_text: string;
  note: string | null;
};

export default function EditPricingItemPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [item, setItem] = useState<PricingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("pricing_items")
        .select("id, sort_order, is_active, name, duration_minutes, price_text, note")
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;

      if (error || !data) {
        alert(error?.message ?? "Not found");
        router.push("/admin/pricing");
        return;
      }

      setItem(data as PricingItem);
      setLoading(false);
    }

    if (id) void load();

    return () => {
      alive = false;
    };
  }, [id, router]);

  async function onSave() {
    if (!item) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("pricing_items")
        .update({
          name: item.name,
          duration_minutes: item.duration_minutes,
          price_text: item.price_text,
          note: item.note,
          is_active: item.is_active,
        })
        .eq("id", item.id);

      if (error) {
        alert(error.message);
        return;
      }

      router.push("/admin/pricing");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !item) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="h-8 w-56 rounded bg-black/10" />
          <div className="mt-8 h-72 rounded-2xl border border-black/10 bg-black/[0.02]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Edit Pricing Item</h1>
            <p className="mt-1 text-sm text-black/60">
              Update the price info shown on the website.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin/pricing")}
            className="rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-sm"
          >
            Back
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4">
            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Name
              </div>
              <input
                value={item.name}
                onChange={(e) =>
                  setItem((p) => (p ? { ...p, name: e.target.value } : p))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Duration (minutes)
              </div>
              <input
                value={item.duration_minutes ?? ""}
                onChange={(e) =>
                  setItem((p) =>
                    p
                      ? {
                          ...p,
                          duration_minutes:
                            e.target.value === "" ? null : Number(e.target.value),
                        }
                      : p
                  )
                }
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Price Text
              </div>
              <input
                value={item.price_text}
                onChange={(e) =>
                  setItem((p) => (p ? { ...p, price_text: e.target.value } : p))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Note (optional)
              </div>
              <input
                value={item.note ?? ""}
                onChange={(e) =>
                  setItem((p) => (p ? { ...p, note: e.target.value || null } : p))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                checked={item.is_active}
                onChange={(e) =>
                  setItem((p) => (p ? { ...p, is_active: e.target.checked } : p))
                }
                className="h-4 w-4"
              />
              <div className="text-sm text-black/70">Active (show publicly)</div>
            </label>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !item.name.trim() || !item.price_text.trim()}
              className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
