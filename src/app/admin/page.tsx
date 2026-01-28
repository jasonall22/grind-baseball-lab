"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CardDef = {
  id: string;
  href: string;
  title: string;
  desc: string;
};

const STORAGE_KEY = "grind_admin_dashboard_cards_v1";

function moveItem<T>(arr: T[], fromIndex: number, toIndex: number) {
  const next = arr.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function AdminPage() {
  const defaultCards: CardDef[] = useMemo(
    () => [
      {
        id: "hero",
        href: "/admin/hero",
        title: "Hero Slider",
        desc: "Control hero images and messaging.",
      },
      {
        id: "news",
        href: "/admin/news",
        title: "News & Updates",
        desc: "Manage homepage news slides.",
      },
      {
        id: "memberships",
        href: "/admin/memberships",
        title: "Memberships",
        desc: "Manage membership tiers and pricing.",
      },
      {
        id: "pricing",
        href: "/admin/pricing",
        title: "Pricing",
        desc: "Manage cage rental prices and booking link.",
      },
      {
        id: "trainers",
        href: "/admin/trainers",
        title: "Trainers",
        desc: "Add, edit, reorder, and manage trainers.",
      },
    ],
    []
  );

  const cardMap = useMemo(() => {
    const m = new Map<string, CardDef>();
    for (const c of defaultCards) m.set(c.id, c);
    return m;
  }, [defaultCards]);

  const [reorderMode, setReorderMode] = useState(false);
  const [cards, setCards] = useState<CardDef[]>(defaultCards);

  // Pointer-drag state
  const draggingIdRef = useRef<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  // Load saved order
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const ids = JSON.parse(raw) as unknown;
      if (!Array.isArray(ids)) return;

      const seen = new Set<string>();
      const ordered: CardDef[] = [];

      for (const id of ids) {
        if (typeof id !== "string") continue;
        if (seen.has(id)) continue;
        const card = cardMap.get(id);
        if (card) {
          ordered.push(card);
          seen.add(id);
        }
      }

      // Append any new cards not in storage
      for (const c of defaultCards) {
        if (!seen.has(c.id)) ordered.push(c);
      }

      if (ordered.length) setCards(ordered);
    } catch {
      // ignore
    }
  }, [cardMap, defaultCards]);

  // Persist order
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cards.map((c) => c.id))
      );
    } catch {
      // ignore
    }
  }, [cards]);

  function onCardPointerDown(e: React.PointerEvent, id: string) {
    if (!reorderMode) return;

    // Only left-click / primary touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    draggingIdRef.current = id;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;

    // Capture pointer so moves keep coming
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function onCardPointerMove(e: React.PointerEvent) {
    if (!reorderMode) return;

    const draggingId = draggingIdRef.current;
    const start = startRef.current;
    if (!draggingId || !start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!movedRef.current) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 6) return; // deadzone so taps still feel normal
      movedRef.current = true;
    }

    // Find the card under the pointer
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const cardEl = el?.closest?.("[data-card-id]") as HTMLElement | null;
    const overId = cardEl?.getAttribute?.("data-card-id") ?? null;

    if (!overId || overId === draggingId) return;

    setCards((prev) => {
      const fromIndex = prev.findIndex((c) => c.id === draggingId);
      const toIndex = prev.findIndex((c) => c.id === overId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      if (fromIndex === toIndex) return prev;

      const next = moveItem(prev, fromIndex, toIndex);
      draggingIdRef.current = draggingId;
      return next;
    });

    e.preventDefault();
    e.stopPropagation();
  }

  function onCardPointerUp(e: React.PointerEvent) {
    if (!reorderMode) return;

    const didMove = movedRef.current;

    draggingIdRef.current = null;
    startRef.current = null;

    if (didMove) {
      // Prevent the click that would navigate
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onCardClick(e: React.MouseEvent) {
    if (!reorderMode) return;
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>

        <button
          type="button"
          onClick={() => setReorderMode((v) => !v)}
          className="rounded-2xl border border-black/10 px-4 py-2 text-sm hover:border-black/30 transition"
        >
          {reorderMode ? "Done" : "Reorder cards"}
        </button>
      </div>

      {reorderMode ? (
        <div className="mb-4 text-sm text-black/60">
          Drag cards to change the order. It saves automatically.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const isDragging = reorderMode && draggingIdRef.current === card.id;

          return (
            <Link
              key={card.id}
              href={card.href}
              data-card-id={card.id}
              onClick={onCardClick}
              onPointerDown={(e) => onCardPointerDown(e, card.id)}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              className={[
                "rounded-2xl border border-black/10 p-5 hover:border-black/30 transition",
                reorderMode ? "cursor-grab select-none" : "",
                isDragging ? "cursor-grabbing" : "",
              ].join(" ")}
              style={reorderMode ? ({ touchAction: "none" } as any) : undefined}
            >
              <div className="font-semibold">{card.title}</div>
              <div className="mt-1 text-sm text-black/60">{card.desc}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
