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

type ScreenKind = "mobile" | "tablet" | "desktop";

function getScreenKind(): ScreenKind {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/**
 * HeroSlider (Responsive + Placeholder)
 * - NO fallback slide content (per request)
 * - Placeholder reserves the SAME hero height so nothing "shrinks" while loading
 */
export default function HeroSlider() {
  const [settings, setSettings] = useState<HeroSettingsRow>(DEFAULT_SETTINGS);
  const [slides, setSlides] = useState<HeroSlideRow[]>([]);
  const [idx, setIdx] = useState(0);

  const [screen, setScreen] = useState<ScreenKind>(() => getScreenKind());

  const timerRef = useRef<number | null>(null);

  // Track screen size
  useEffect(() => {
    function onResize() {
      setScreen(getScreenKind());
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load settings + slides from Supabase
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
      } else {
        // No fallback content — keep placeholder
        setSlides([]);
        setIdx(0);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSlides = slides.length > 0;

  function clampIdx(next: number) {
    if (slides.length === 0) return 0;
    const n = slides.length;
    return (next + n) % n;
  }

  const safeIdx = Math.max(0, Math.min(idx, Math.max(0, slides.length - 1)));
  const slide = hasSlides ? slides[safeIdx] : null;

  const effectiveOverlayOpacity =
    typeof slide?.overlay_opacity === "number" ? slide.overlay_opacity : settings.overlay_opacity;

  // Height tuning (mobile gets extra room so text never clips)
  const heightPx = useMemo(() => {
    const d = settings.height_desktop;
    const m = settings.height_mobile;

    if (screen === "mobile") return Math.max(m, 560);
    if (screen === "tablet") return Math.max(Math.round(m + (d - m) * 0.6), 520);
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

  function prev() {
    setIdx((v) => clampIdx(v - 1));
  }

  function next() {
    setIdx((v) => clampIdx(v + 1));
  }

  // Auto-rotate (only when we actually have multiple slides)
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

  const showArrows = settings.show_arrows && slides.length > 1 && screen !== "mobile";
  const arrowsOnDesktop = screen === "desktop";

  const arrowBase =
    "absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition-none";
  const arrowVisibility = arrowsOnDesktop ? "opacity-0 group-hover:opacity-100" : "opacity-100";
  const arrowSize = "h-11 w-11 text-sm";

  const wrapPadding = screen === "mobile" ? "px-5 py-8" : "px-6 sm:px-12";
  const maxTextWidth = screen === "mobile" ? "max-w-[26rem]" : "max-w-3xl";

  const headlineCls =
    screen === "mobile"
      ? "text-[10px] tracking-[0.24em]"
      : "text-[11px] tracking-[0.28em]";

  const titleCls =
    screen === "mobile"
      ? "text-2xl leading-[1.06]"
      : "text-3xl sm:text-4xl md:text-5xl leading-tight";

  const bodyCls =
    screen === "mobile"
      ? "text-[13px] leading-[1.45]"
      : "text-sm sm:text-base leading-relaxed";

  const ctaCls = screen === "mobile" ? "px-6 py-2.5 text-sm" : "px-8 py-3 text-sm";

  const dotsBottom = screen === "mobile" ? "bottom-4" : "bottom-6";

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div
          className="group relative mx-auto w-full overflow-hidden rounded-[34px]"
          // ✅ Force BOTH height + minHeight so placeholder is never smaller
          style={{
            height: `${heightPx}px`,
            minHeight: `${heightPx}px`,
            ...bgStyle,
          }}
        >
          {/* Overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: settings.overlay_color,
              opacity: effectiveOverlayOpacity,
            }}
          />

          {/* Content */}
          <div className={"relative z-10 flex h-full w-full flex-col justify-center " + wrapPadding}>
            <div className={`mx-auto flex w-full ${maxTextWidth} flex-col ${textAlignClass}`}>
              {!hasSlides ? (
                <>
                  <div className={`${headlineCls} uppercase`} style={{ color: "rgba(255,255,255,0.65)" }}>
                    THE GRIND BASEBALL LAB
                  </div>
                  <h1 className={`mt-3 sm:mt-4 font-semibold ${titleCls}`} style={{ color: settings.text_color }}>
                    Hero Slider Placeholder
                  </h1>
                  <p className={`mt-3 sm:mt-4 ${bodyCls}`} style={{ color: "rgba(255,255,255,0.86)" }}>
                    Add slides in Admin → Hero Slider. Once active slides exist, they will show here.
                  </p>
                </>
              ) : (
                <>
                  {slide?.headline ? (
                    <div className={`${headlineCls} uppercase`} style={{ color: "rgba(255,255,255,0.65)" }}>
                      {slide.headline}
                    </div>
                  ) : null}

                  <h1 className={`mt-3 sm:mt-4 font-semibold ${titleCls}`} style={{ color: settings.text_color }}>
                    {slide?.title}
                  </h1>

                  {slide?.body ? (
                    <p
                      className={`mt-3 sm:mt-4 ${bodyCls} text-white/85 break-words ${screen === "mobile" ? "line-clamp-6" : ""}`}
                    >
                      {slide.body}
                    </p>
                  ) : null}

                  {slide?.cta_text ? (
                    <div className="mt-5 sm:mt-6">
                      <a
                        href={slide.cta_href || "#"}
                        className={`inline-flex items-center justify-center rounded-full bg-white font-medium text-black ${ctaCls}`}
                      >
                        {slide.cta_text}
                      </a>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Dots */}
          {settings.show_dots && slides.length > 1 ? (
            <div className={`absolute ${dotsBottom} left-1/2 z-20 flex -translate-x-1/2 items-center gap-2`}>
              {slides.map((_, i) => {
                const active = i === idx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={
                      active
                        ? "h-2 w-10 rounded-full bg-white transition-none"
                        : `rounded-full bg-white/35 transition-none ${screen === "mobile" ? "h-3 w-3" : "h-2 w-2"}`
                    }
                  />
                );
              })}
            </div>
          ) : null}

          {/* Arrows */}
          {showArrows ? (
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
