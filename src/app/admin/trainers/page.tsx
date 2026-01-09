"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Trainer = {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  sort_order: number | null;
};

export default function TrainersAdminPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("trainers")
      .select("id, first_name, last_name, title, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setTrainers(data ?? []);
    setLoading(false);
  }

  function onDragStart(id: string) {
    setDraggingId(id);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return;

    const items = [...trainers];
    const fromIndex = items.findIndex((t) => t.id === draggingId);
    const toIndex = items.findIndex((t) => t.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);

    setTrainers(items);
    setDraggingId(null);
  }

  async function saveOrder() {
    setSavingOrder(true);

    const updates = trainers.map((t, idx) => ({
      id: t.id,
      sort_order: idx + 1,
    }));

    for (const row of updates) {
      await supabase
        .from("trainers")
        .update({ sort_order: row.sort_order })
        .eq("id", row.id);
    }

    setSavingOrder(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trainers</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={saveOrder}
            disabled={savingOrder}
            className="rounded-full border border-black/25 px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {savingOrder ? "Saving…" : "Save Order"}
          </button>

          <Link
            href="/admin/trainers/new"
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white"
          >
            Add Trainer
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-black/60">Loading…</div>
      ) : trainers.length === 0 ? (
        <div className="rounded-2xl border border-black/10 p-10 text-center text-black/60">
          No trainers yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {trainers.map((t) => (
            <li
              key={t.id}
              draggable
              onDragStart={() => onDragStart(t.id)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(t.id)}
              className={`flex items-center justify-between rounded-xl border p-4 cursor-move
                ${draggingId === t.id ? "border-black" : "border-black/10"}
              `}
            >
              <div>
                <div className="font-semibold">
                  {t.first_name} {t.last_name}
                </div>
                {t.title && (
                  <div className="text-sm text-black/60">{t.title}</div>
                )}
              </div>

              <Link
                href={`/admin/trainers/${t.id}`}
                className="text-sm text-black/50"
              >
                Edit →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
