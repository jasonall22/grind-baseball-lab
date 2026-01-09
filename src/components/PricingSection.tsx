"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PricingItem = {
  id: string;
  sort_order: number;
  is_active: boolean;
  name: string;
  duration_minutes: number | null;
  price_text: string;
  note: string | null;
  updated_at?: string | null;
};

type PricingSettings = {
  key: string;
  heading: string;
  subheading: string | null;
  booking_url: string;
  button_text: string;
  updated_at?: string | null;
};

const DEFAULT_SETTINGS: PricingSettings = {
  key: "default",
  heading: "BOOK CAGE TIME HERE",
  subheading: "Looking to rent cages at an hourly rate? Prices are listed below.",
  booking_url: "https://book.runswiftapp.com/facilities/the-grind-baseball-lab",
  button_text: "Book Here",
};

const FALLBACK_ITEMS: PricingItem[] = [
  {
    id: "fallback-1",
    sort_order: 1,
    is_active: true,
    name: "Pitching Lane Rental",
    duration_minutes: 30,
    price_text: "$30",
    note: null,
    updated_at: null,
  },
  {
    id: "fallback-2",
    sort_order: 2,
    is_active: true,
    name: "Batting Cage with Machine",
    duration_minutes: 30,
    price_text: "$35",
    note: null,
    updated_at: null,
  },
  {
    id: "fallback-3",
    sort_order: 3,
    is_active: true,
    name: "HitTrax Batting Cage with Machine",
    duration_minutes: 30,
    price_text: "$50",
    note: null,
    updated_at: null,
  },
];

function fmtDuration(mins: number | null) {
  if (!mins) return "";
  if (mins === 60) return "60 Minute";
  return `${mins} Minute`;
}

function fmtUpdated(ts?: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default function PricingSection() {
  const fallback = useMemo(() => FALLBACK_ITEMS, []);

  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_SETTINGS);
  const [items, setItems] = useState<PricingItem[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: s, error: sErr } = await supabase
        .from("pricing_settings")
        .select("key, heading, subheading, booking_url, button_text, updated_at")
        .eq("key", "default")
        .maybeSingle();

      const { data: rows, error: rErr } = await supabase
        .from("pricing_items")
        .select("id, sort_order, is_active, name, duration_minutes, price_text, note, updated_at")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(50);

      if (!alive) return;

      if (!sErr && s) {
        setSettings((prev) => ({ ...prev, ...s } as PricingSettings));
      }

      if (!rErr && Array.isArray(rows) && rows.length > 0) {
        setItems(rows as PricingItem[]);
      } else {
        setItems(fallback);
      }

      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, [fallback]);

  const visibleItems = loading ? fallback : items;

  const lastUpdated = useMemo(() => {
    const sDate = fmtUpdated(settings.updated_at);
    if (sDate) return sDate;

    const newest = [...(items ?? [])]
      .map((it) => it.updated_at ?? null)
      .filter(Boolean)
      .sort()
      .pop();

    return fmtUpdated(newest ?? null);
  }, [settings.updated_at, items]);

  return (
    <section id="pricing" className="bg-white text-black">
      <div className="mx-auto max-w-6xl px-4 py-14">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-center text-4xl sm:text-5xl md:text-6xl font-light tracking-wide text-black">
            {settings.heading}
          </h2>

          {settings.subheading ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-black/60">
              {settings.subheading}
            </p>
          ) : null}
        </div>

        {/* Card with modern “gradient border” + soft glow */}
        <div className="relative mt-10">
          {/* subtle glow */}
          <div className="pointer-events-none absolute -inset-6 opacity-60 blur-3xl">
            <div className="h-full w-full rounded-[36px] bg-gradient-to-br from-[#1FA2FF]/20 via-black/5 to-black/10" />
          </div>

          {/* gradient border wrapper */}
          <div className="relative rounded-3xl bg-gradient-to-br from-black/15 via-black/5 to-[#1FA2FF]/25 p-[1px]">
            <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
              {/* Rows */}
              <div className="divide-y divide-black/10">
                {visibleItems.map((it) => (
                  <div
                    key={it.id}
                    className="group relative px-5 py-5 sm:px-8 transition-all duration-200 hover:bg-black/[0.02]"
                  >
                    {/* left accent bar on hover */}
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-transparent transition-colors duration-200 group-hover:bg-[#1FA2FF]" />

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {it.duration_minutes ? (
                            <span className="inline-flex items-center rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-semibold text-black/70 shadow-sm">
                              {fmtDuration(it.duration_minutes)}
                            </span>
                          ) : null}

                          <div className="text-base sm:text-lg font-semibold text-black">
                            {it.name}
                          </div>
                        </div>

                        {it.note ? (
                          <div className="mt-2 text-sm text-black/60">{it.note}</div>
                        ) : (
                          <div className="mt-2 text-sm text-black/50">
                            Fast booking • Instant confirmation
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 group-hover:-translate-y-[1px] group-hover:shadow-md">
                          {it.price_text}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-black/10 bg-white px-5 py-7 sm:px-8">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="text-sm text-black/60">
                    Click “{settings.button_text}” to open Swift booking.
                  </div>

                  <a
                    href={settings.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-black px-9 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-black/10"
                  >
                    <span>{settings.button_text}</span>
                    <span className="text-white/70 transition-transform duration-200 group-hover:translate-x-[2px]">
                      →
                    </span>
                  </a>

                  {lastUpdated ? (
                    <div className="mt-2 text-xs text-black/40">
                      Updated {lastUpdated}
                    </div>
                  ) : loading ? (
                    <div className="mt-2 text-xs text-black/40">Loading…</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 h-px w-full bg-black/10" />
      </div>
    </section>
  );
}
