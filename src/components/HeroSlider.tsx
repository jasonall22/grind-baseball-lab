"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type HeroSettingsRow = {
  key: string;
  height_desktop: number;
  height_mobile: number;
  text_align: "left" | "center";
  overlay_color: string; // hex like #000000
  overlay_opacity: number; // 0..0.95
  text_color: string; // hex
  show_arrows: boolean;
  show_dots: boolean;
  auto_rotate: boolean;
  interval_ms: number;
};

type HeroSlideRow = {
  id: string;
  sort_order: number;
  is_active: boolean;
  headline: string;
  title: string;
  body: string;
  cta_text: string;
  cta_href: string;
  image_url: string | null;
  overlay_opacity: number | null;
};

const DEFAULT_SETTINGS: HeroSettingsRow = {
  key: "default",
  height_desktop: 520,
  height_mobile: 440,
  text_align: "center",
  overlay_color: "#000000",
  overlay_opacity: 0.45,
  text_color: "#ffffff",
  show_arrows: true,
  show_dots: true,
  auto_rotate: true,
  interval_ms: 6000,
};

const FALLBACK_SLIDES: HeroSlideRow[] = [
  {
    id: "fallback-1",
    sort_order: 1,
    is_active: true,
    headline: "HITTRAX • CAGES • LESSONS",
    title: "Train like it matters.",
    body: "Cages, HitTrax, lessons, clinics, and camps — built for serious hitters.",
    cta_text: "Book Now",
    cta_href: "#book",
    image_url: null,
    overlay_opacity: null,
  },
];

/**
 * HeroSlider
 * - Pulls hero settings + slides from Supabase (hero_settings, hero_slides)
 * - Matches the “big rounded dark card centered on white page” style
 *
 * ✅ Fix: remove the quick “flash bar” on first load.
 *    We wait until the initial Supabase load finishes before rendering anything.
 *
 * ✅ Fix: React Hooks order error
 *    Do NOT return early before hooks like useMemo run.
 *    We compute hooks first, then conditionally return at the end.
 */
export default function HeroSlider() {
  const [settings, setSettings] = useState<HeroSettingsRow>(DEFAULT_SETTINGS);

  // Start empty so we DON'T render fallback first, then swap quickly.
  const [slides, setSlides] = useState<HeroSlideRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Prevent setInterval drift/leaks
  const timerRef = useRef<number | null>(null);

  // Gate render until mounted + initial load complete (prevents the “flash bar”).
  const [mounted, setMounted] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1) Detect mobile for height choice
  useEffect(() => {
    if (!mounted) return;

    function onResize() {
      setIsMobile(window.innerWidth < 768);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  // 2) Load settings + slides from Supabase
  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function load() {
      try {
        // Settings (single row key='default')
        const { data: s, error: sErr } = await supabase
          .from("hero_settings")
          .select("*")
          .eq("key", "default")
          .maybeSingle();

        // Slides (active only)
        const { data: sl, error: slErr } = await supabase
          .from("hero_slides")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (cancelled) return;

        if (!sErr && s) {
          setSettings((prev) => ({ ...prev, ...s } as HeroSettingsRow));
        }

        if (!slErr && Array.isArray(sl) && sl.length > 0) {
          setSlides(sl as HeroSlideRow[]);
          setIdx(0);
        } else {
          // If no slides exist yet, use fallback (but ONLY after initial load completes).
          setSlides(FALLBACK_SLIDES);
          setIdx(0);
        }
      } finally {
        if (!cancelled) setInitialLoaded(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const safeSlides = slides.length > 0 ? slides : FALLBACK_SLIDES;
  const slide = safeSlides[idx] ?? safeSlides[0] ?? FALLBACK_SLIDES[0];

  const effectiveOverlayOpacity =
    typeof slide?.overlay_opacity === "number"
      ? slide.overlay_opacity
      : settings.overlay_opacity;

  const heightPx = isMobile ? settings.height_mobile : settings.height_desktop;

  const textAlignClass =
    settings.text_align === "left"
      ? "items-start text-left"
      : "items-center text-center";

  const bgStyle = useMemo(() => {
    // If you set image_url from Supabase, it will be used as the background.
    // We still keep a subtle gradient even with an image (looks like your reference).
    const baseGradient =
      "linear-gradient(90deg, rgba(6,20,34,0.92) 0%, rgba(6,20,34,0.78) 55%, rgba(6,20,34,0.55) 100%)";

    if (slide?.image_url) {
      return {
        backgroundImage: `${baseGradient}, url(${slide.image_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } as React.CSSProperties;
    }

    return {
      backgroundImage:
        "linear-gradient(135deg, #071b2e 0%, #051524 50%, #071b2e 100%)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as React.CSSProperties;
  }, [slide?.image_url]);

  function clampIdx(next: number) {
    if (safeSlides.length === 0) return 0;
    const n = safeSlides.length;
    return (next + n) % n;
  }

  function prev() {
    setIdx((v) => clampIdx(v - 1));
  }

  function next() {
    setIdx((v) => clampIdx(v + 1));
  }

  // 3) Auto-rotate (if enabled in settings)
  useEffect(() => {
    // clear old
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!settings.auto_rotate) return;
    if (safeSlides.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setIdx((v) => clampIdx(v + 1));
    }, settings.interval_ms);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.auto_rotate, settings.interval_ms, safeSlides.length]);

  // ✅ IMPORTANT: only return here (after hooks) to avoid Rules of Hooks error.
  if (!mounted || !initialLoaded) return null;

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        {/* Big centered rounded “hero card” */}
        <div
          className="group relative mx-auto w-full overflow-hidden rounded-[34px]"
          style={{ height: `${heightPx}px`, ...bgStyle }}
        >
          {/* Dark overlay (matches the reference’s moody look) */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: settings.overlay_color,
              opacity: effectiveOverlayOpacity,
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex h-full w-full flex-col justify-center px-6 sm:px-12">
            <div
              className={`mx-auto flex w-full max-w-3xl flex-col ${textAlignClass}`}
            >
              {slide?.headline ? (
                <div
                  className="text-[11px] tracking-[0.28em] uppercase"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {slide.headline}
                </div>
              ) : null}

              <h1
                className="mt-4 text-3xl sm:text-4xl md:text-5xl font-semibold leading-tight"
                style={{ color: settings.text_color }}
              >
                {slide?.title}
              </h1>

              {slide?.body ? (
                <p
                  className="mt-4 text-sm sm:text-base leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.86)" }}
                >
                  {slide.body}
                </p>
              ) : null}

              {slide?.cta_text ? (
                <div className="mt-6">
                  <a
                    href={slide.cta_href || "#"}
                    className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-medium text-black"
                  >
                    {slide.cta_text}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Dots */}
          {settings.show_dots && safeSlides.length > 1 ? (
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
              {safeSlides.map((_, i) => {
                const active = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`rounded-full transition-none ${
                      active ? "h-2 w-10 bg-white" : "h-2 w-2 bg-white/35"
                    }`}
                  />
                );
              })}
            </div>
          ) : null}

          {/* Arrows (hidden until hover, like the reference) */}
          {settings.show_arrows && safeSlides.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous slide"
                className="absolute left-6 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-white opacity-0 transition-none group-hover:opacity-100"
              >
                ←
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next slide"
                className="absolute right-6 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-white opacity-0 transition-none group-hover:opacity-100"
              >
                →
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* gray divider line under the hero section (leave as-is if you still want it) */}
      <div className="h-px w-full bg-gray-200" />
    </section>
  );
}
