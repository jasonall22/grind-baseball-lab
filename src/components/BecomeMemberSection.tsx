"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Tier = {
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

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
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
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative mx-auto mt-10 w-[92vw] max-w-xl rounded-2xl bg-white text-black shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-black/60">More info</div>
            <div className="mt-1 text-lg font-semibold">{title}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/15 px-3 py-1.5 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-5 py-4 text-sm leading-relaxed text-black/80">
          {children}
        </div>
      </div>
    </div>
  );
}

function MembershipCard({
  tier,
  bars,
  onMoreInfo,
}: {
  tier: Tier;
  bars: number[];
  onMoreInfo: () => void;
}) {
  return (
    <div className="h-full flex justify-center">
      <div className="w-full max-w-[320px] h-full">
        <div className="h-[560px] rounded-[18px] bg-black overflow-hidden flex flex-col">
          <div className="px-8 pt-10 text-center">
            {tier.title ? (
              <div className="text-xs font-semibold tracking-[0.25em] text-white">
                {tier.title}
              </div>
            ) : null}

            <div className="mt-2 text-5xl font-extrabold leading-none text-[#0284C7]">
              {tier.price_text}
            </div>

            <div className="mt-2 text-sm font-semibold tracking-wide text-white">
              {tier.period_text}
            </div>
          </div>

          <div className="mt-8 px-8">
            <div className="h-24 w-full flex items-end justify-between">
              {bars.map((h, idx) => (
                <div
                  key={idx}
                  className="w-[2px] bg-[#0284C7] rounded-sm"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
          </div>

          <div className="px-8 pt-6 text-center text-white flex-1 flex flex-col">
            <p className="text-xs leading-relaxed text-white/80 line-clamp-5">
              {tier.note ?? ""}
            </p>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onMoreInfo}
                className="rounded-full border border-white/35 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0284C7] hover:border-[#0284C7]"
              >
                More info
              </button>
            </div>
          </div>

          <div className="px-8 pb-10 pt-6 flex justify-center">
            <div className="rounded-full border border-white/35 bg-white/10 p-1">
              <a
                href={tier.cta_href}
                className="inline-flex items-center justify-center rounded-full bg-white px-10 py-2.5 text-sm font-semibold text-black hover:bg-[#0284C7] hover:text-white"
              >
                {tier.cta_text}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BecomeMemberSection() {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [openTierId, setOpenTierId] = useState<string | null>(null);

  const bars = useMemo(
    () => [
      62, 14, 55, 32, 70, 20, 48, 28, 66, 24, 40, 18, 58, 36, 72, 26, 44, 16,
      64, 22, 52, 30, 68, 12, 46, 34, 60, 25, 50, 19, 67, 29, 54, 17, 61, 23,
      49, 31, 69, 13, 45, 35, 63, 21, 51, 27, 65, 15, 47, 33, 71, 11, 43, 37,
      59, 24, 53, 28, 66, 18, 48, 32, 70, 20, 44, 26, 62, 16, 52, 30, 68, 14,
      46, 34, 60, 22,
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase
        .from("membership_tiers")
        .select(
          "id, sort_order, title, price_text, period_text, note, cta_text, cta_href, is_active"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(3);

      if (!alive) return;
      setTiers((data as Tier[]) ?? null);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const fallback: Tier[] = [
    {
      id: "fallback-1",
      sort_order: 1,
      title: "Basic Membership",
      price_text: "$150",
      period_text: "PER MONTH",
      note: "Our batting cages membership is a credit based system with online booking and real time availability.",
      cta_text: "Join",
      cta_href: "/signup",
      is_active: true,
    },
    {
      id: "fallback-2",
      sort_order: 2,
      title: "Minors Member Package w/ HitTrax",
      price_text: "$200",
      period_text: "PER MONTH",
      note: "Placeholder (Membership #2). We will replace with your real details.",
      cta_text: "Join",
      cta_href: "/signup",
      is_active: true,
    },
    {
      id: "fallback-3",
      sort_order: 3,
      title: "Training Membership",
      price_text: "$300",
      period_text: "PER MONTH",
      note: "Placeholder (Membership #3). We will replace with your real details.",
      cta_text: "Join",
      cta_href: "/signup",
      is_active: true,
    },
  ];

  const show = tiers && tiers.length ? tiers : fallback;
  const openTier = show.find((t) => t.id === openTierId) ?? null;

  return (
    <section id="membership" className="bg-white text-black">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center leading-[0.85] font-extrabold tracking-tight select-none">
          <div className="text-[64px] sm:text-[96px] md:text-[132px] lg:text-[170px] text-black">
            BECOME
          </div>
          <div className="text-[64px] sm:text-[96px] md:text-[132px] lg:text-[170px] text-black">
            A MEMBER
          </div>
        </div>

        <div className="mt-14 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {show.map((tier) => (
            <MembershipCard
              key={tier.id}
              tier={tier}
              bars={bars}
              onMoreInfo={() => setOpenTierId(tier.id)}
            />
          ))}
        </div>
      </div>

      <Modal
        open={!!openTier}
        title={
          openTier ? `${openTier.price_text} ${openTier.period_text}` : "Membership"
        }
        onClose={() => setOpenTierId(null)}
      >
        <div className="mt-3 whitespace-pre-wrap">{openTier?.note ?? ""}</div>
      </Modal>
    </section>
  );
}
