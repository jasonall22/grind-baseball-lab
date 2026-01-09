"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type PricingSettings = {
  key: string;
  heading: string;
  subheading: string | null;
  booking_url: string;
  button_text: string;
};

const DEFAULT_SETTINGS: PricingSettings = {
  key: "default",
  heading: "BOOK CAGE TIME HERE",
  subheading: "Looking to rent cages at an hourly rate? Prices are listed below.",
  booking_url: "https://book.runswiftapp.com/facilities/the-grind-baseball-lab",
  button_text: "Book Here",
};

function fmtDuration(mins: number | null) {
  if (!mins) return "";
  if (mins === 60) return "60 Minute";
  return `${mins} Minute`;
}

function SavedModal({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  // Auto-close after a short moment
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => onClose(), 1800);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-lg">
        <div className="text-lg font-semibold text-black">Saved</div>
        <div className="mt-2 text-sm text-black/70">{message}</div>

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPricingPage() {
  const router = useRouter();
  const fallback = useMemo(() => [] as PricingItem[], []);

  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<PricingItem[]>(fallback);
  const [loading, setLoading] = useState(true);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [savedOpen, setSavedOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState("Your changes have been saved.");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: s } = await supabase
        .from("pricing_settings")
        .select("*")
        .eq("key", "default")
        .maybeSingle();

      const { data: rows } = await supabase
        .from("pricing_items")
        .select("id, sort_order, is_active, name, duration_minutes, price_text, note")
        .order("sort_order", { ascending: true })
        .limit(200);

      if (!alive) return;

      if (s) setSettings((prev) => ({ ...prev, ...s } as PricingSettings));
      if (Array.isArray(rows)) setItems(rows as PricingItem[]);

      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const payload: PricingSettings = {
        key: "default",
        heading: settings.heading,
        subheading: settings.subheading ?? null,
        booking_url: settings.booking_url,
        button_text: settings.button_text,
      };

      const { error } = await supabase
        .from("pricing_settings")
        .upsert(payload, { onConflict: "key" });

      if (error) {
        alert(error.message);
        return;
      }

      setSavedMsg("Settings saved.");
      setSavedOpen(true);
    } finally {
      setSavingSettings(false);
    }
  }

  function moveItem(id: string, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;

    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= items.length) return;

    const copy = [...items];
    const a = copy[idx];
    const b = copy[nextIdx];
    copy[idx] = b;
    copy[nextIdx] = a;

    const renumbered = copy.map((it, i) => ({ ...it, sort_order: i + 1 }));
    setItems(renumbered);
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      const updates = items.map((it) => ({
        id: it.id,
        sort_order: it.sort_order,
      }));

      const { error } = await supabase
        .from("pricing_items")
        .upsert(updates, { onConflict: "id" });

      if (error) {
        alert(error.message);
        return;
      }

      // Keep existing behavior as simple message, but no browser alert
      setSavedMsg("Order saved.");
      setSavedOpen(true);
    } finally {
      setSavingOrder(false);
    }
  }

  async function toggleActive(id: string, next: boolean) {
    const { error } = await supabase
      .from("pricing_items")
      .update({ is_active: next })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, is_active: next } : it))
    );
  }

  async function deleteItem(id: string) {
    const ok = confirm("Delete this price item?");
    if (!ok) return;

    const { error } = await supabase.from("pricing_items").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="h-8 w-48 rounded bg-black/10" />
          <div className="mt-6 h-40 rounded-2xl border border-black/10 bg-black/[0.02]" />
          <div className="mt-10 h-72 rounded-2xl border border-black/10 bg-black/[0.02]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <SavedModal
        open={savedOpen}
        message={savedMsg}
        onClose={() => setSavedOpen(false)}
      />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Pricing</h1>
            <p className="mt-1 text-sm text-black/60">
              This controls the public Pricing section.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin/pricing/new")}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-black">Section Settings</div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Heading
              </div>
              <input
                value={settings.heading}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, heading: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Button Text
              </div>
              <input
                value={settings.button_text}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, button_text: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Subheading
              </div>
              <input
                value={settings.subheading ?? ""}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, subheading: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>

            <label className="block sm:col-span-2">
              <div className="text-xs font-semibold tracking-wide text-black/60">
                Booking URL (Swift)
              </div>
              <input
                value={settings.booking_url}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, booking_url: e.target.value }))
                }
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black/20"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* Items list */}
        <div className="mt-8 rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-5">
            <div className="text-sm font-semibold text-black">Price Items</div>
            <button
              type="button"
              onClick={saveOrder}
              disabled={savingOrder}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm disabled:opacity-60"
            >
              {savingOrder ? "Saving..." : "Save Order"}
            </button>
          </div>

          <div className="divide-y divide-black/10">
            {items.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-black/60">
                No items yet. Click “Add Item”.
              </div>
            ) : (
              items.map((it, i) => (
                <div key={it.id} className="px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-black">
                        {fmtDuration(it.duration_minutes)} {it.name}
                      </div>
                      <div className="mt-1 text-sm text-black/60">
                        Price:{" "}
                        <span className="font-semibold text-black">
                          {it.price_text}
                        </span>
                        {" • "}
                        Sort:{" "}
                        <span className="font-semibold text-black">
                          {it.sort_order}
                        </span>
                        {" • "}
                        Status:{" "}
                        <span
                          className={
                            it.is_active
                              ? "font-semibold text-black"
                              : "font-semibold text-black/50"
                          }
                        >
                          {it.is_active ? "Active" : "Hidden"}
                        </span>
                      </div>
                      {it.note ? (
                        <div className="mt-2 text-sm text-black/60">{it.note}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveItem(it.id, -1)}
                        disabled={i === 0}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(it.id, 1)}
                        disabled={i === items.length - 1}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm disabled:opacity-40"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push(`/admin/pricing/${it.id}/edit`)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(it.id, !it.is_active)}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm"
                      >
                        {it.is_active ? "Hide" : "Show"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteItem(it.id)}
                        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-black/10 bg-black/[0.02] p-6 text-sm text-black/70">
          Tip: The public Pricing section shows{" "}
          <span className="font-semibold">Active</span> items only, ordered by{" "}
          <span className="font-semibold">Sort</span>.
        </div>
      </div>
    </div>
  );
}
