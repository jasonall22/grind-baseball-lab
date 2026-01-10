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
    cta_href: "#pricing",
    image_url: null,
    overlay_opacity: null,
  },
];

type ScreenKind = "mobile" | "tablet" | "desktop";

function getScreenKind() {
  if (typeof window === "undefined") return "desktop" as ScreenKind;
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * HeroSlider
 * - Pulls hero settings + slides from Supabase (hero_settings, hero_slides)
 * - Matches the “big rounded dark card centered on white page” style
 * - Responsive for phone + tablet (no hover-only controls on touch)
 */
export default function HeroSlider() {
  const [settings, setSettings] = useState<HeroSettingsRow>(DEFAULT_SETTINGS);
  const [slides, setSlides] = useState<HeroSlideRow[]>(FALLBACK_SLIDES);
  const [idx, setIdx] = useState(0);

  // ✅ Fix layout shift: pick initial screen kind without needing an effect
  const [screen, setScreen] = useState<ScreenKind>(() => getScreenKind());

  // Prevent setInterval drift/leaks
  const timerRef = useRef<number | null>(null);

  // 1) Track screen size (mobile/tablet/desktop)
  useEffect(() => {
    function onResize() {
      setScreen(getScreenKind());
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 2) Load settings + slides from Supabase
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: s, error: sErr } = await supabase
        .from("hero_settings")
        .select("*")
        .eq("key", "default")
        .maybeSingle();

      const { data: sl, error: slErr } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (!sErr && s) setSettings((prev) => ({ ...prev, ...s } as HeroSettingsRow));
      if (!slErr && Array.isArray(sl) && sl.length > 0) {
        setSlides(sl as HeroSlideRow[]);
        setIdx(0);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const slide = slides[idx] ?? slides[0] ?? FALLBACK_SLIDES[0];

  const effectiveOverlayOpacity =
    typeof slide?.overlay_opacity === "number" ? slide.overlay_opacity : settings.overlay_opacity;

  // ✅ Responsive height: mobile uses height_mobile, desktop uses height_desktop,
  // tablet blends in-between so iPad looks correct.
  const heightPx = useMemo(() => {
    const d = settings.height_desktop;
    const m = settings.height_mobile;

    if (screen === "mobile") return m;
    if (screen === "tablet") return Math.round(m + (d - m) * 0.55);
    return d;
  }, [screen, settings.height_desktop, settings.height_mobile]);

  const textAlignClass =
    settings.text_align === "left" ? "items-start text-left" : "items-center text-center";

  const bgStyle = useMemo(() => {
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
      backgroundImage: "linear-gradient(135deg, #071b2e 0%, #051524 50%, #071b2e 100%)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as React.CSSProperties;
  }, [slide?.image_url]);

  function clampIdx(next: number) {
    if (slides.length === 0) return 0;
    const n = slides.length;
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
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!settings.auto_rotate) return;
    if (slides.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setIdx((v) => clampIdx(v + 1));
    }, settings.interval_ms);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [settings.auto_rotate, settings.interval_ms, slides.length]);

  // Touch-friendly controls:
  // - On desktop: arrows appear on hover (your original behavior)
  // - On tablet/phone: arrows are visible (hover doesn't exist)
  const arrowBase =
    "absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition-none";
  const arrowVisibility =
    screen === "desktop" ? "opacity-0 group-hover:opacity-100" : "opacity-100";
  const arrowSize = screen === "mobile" ? "h-10 w-10 text-sm" : "h-11 w-11 text-sm";

  // Content sizing tweaks for smaller screens
  const wrapPadding = screen === "mobile" ? "px-5" : "px-6 sm:px-12";
  const headlineSize = screen === "mobile" ? "text-[10px]" : "text-[11px]";
  const titleSize =
    screen === "mobile" ? "text-3xl" : "text-3xl sm:text-4xl md:text-5xl";
  const bodySize = screen === "mobile" ? "text-sm" : "text-sm sm:text-base";

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div
          className="group relative mx-auto w-full overflow-hidden rounded-[34px]"
          style={{ height: `${heightPx}px`, ...bgStyle }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: settings.overlay_color,
              opacity: effectiveOverlayOpacity,
            }}
          />

          <div className={"relative z-10 flex h-full w-full flex-col justify-center " + wrapPadding}>
            <div className={`mx-auto flex w-full max-w-3xl flex-col ${textAlignClass}`}>
              {slide?.headline ? (
                <div
                  className={`${headlineSize} tracking-[0.28em] uppercase`}
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {slide.headline}
                </div>
              ) : null}

              <h1
                className={`mt-4 ${titleSize} font-semibold leading-tight`}
                style={{ color: settings.text_color }}
              >
                {slide?.title}
              </h1>

              {slide?.body ? (
                <p className={`mt-4 ${bodySize} leading-relaxed`} style={{ color: "rgba(255,255,255,0.86)" }}>
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

          {settings.show_dots && slides.length > 1 ? (
            <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
              {slides.map((_, i) => {
                const active = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={[
                      "rounded-full transition-none",
                      active ? "h-2 w-10 bg-white" : "h-2 w-2 bg-white/35",
                      screen === "mobile" && !active ? "h-2.5 w-2.5" : "",
                    ].join(" ").trim()}
                  />
                );
              })}
            </div>
          ) : null}

          {settings.show_arrows && slides.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous slide"
                className={`${arrowBase} ${arrowVisibility} ${arrowSize} left-4 sm:left-6 flex items-center justify-center`}
              >
                ←
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next slide"
                className={`${arrowBase} ${arrowVisibility} ${arrowSize} right-4 sm:right-6 flex items-center justify-center`}
              >
                →
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="h-px w-full bg-gray-200" />
    </section>
  );
}
