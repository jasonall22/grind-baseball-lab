"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewPricingItemPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [duration, setDuration] = useState<string>("30");
  const [priceText, setPriceText] = useState("$");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const { data: maxRow } = await supabase
        .from("pricing_items")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSort = (maxRow?.sort_order ?? 0) + 1;

      const payload = {
        name,
        duration_minutes: duration ? Number(duration) : null,
        price_text: priceText,
        note: note || null,
        is_active: isActive,
        sort_order: nextSort,
      };

      const { error } = await supabase.from("pricing_items").insert(payload);

      if (error) {
        alert(error.message);
        return;
      }

      router.push("/admin/pricing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Add Pricing Item</h1>
            <p className="mt-1 text-sm text-black/60">
              This will appear in the public Pricing section.
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Batting Cage with Machine"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Duration (minutes)
              </div>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Price Text
              </div>
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="$35"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Note (optional)
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="(optional)"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <div className="text-sm text-black/70">Active (show publicly)</div>
            </label>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !name.trim() || !priceText.trim()}
              className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
