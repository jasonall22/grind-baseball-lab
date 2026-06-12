"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  DEFAULT_HERO_SETTINGS,
  type HeroSettingsRow,
  type InitialHeroData,
} from "@/lib/heroTypes";

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

  // Per-slide "darkness" amount (0 = none, 1 = full)
  overlay_opacity: number | null;

  // ✅ Per-line colors (optional)
  headline_color?: string | null;
  title_color?: string | null;
  body_color?: string | null;
  cta_text_color?: string | null;
};

type ScreenKind = "mobile" | "tablet" | "desktop";

function getScreenKind(): ScreenKind {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function preloadImage(url: string, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    if (!url) return resolve();

    const img = new window.Image();
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const t = window.setTimeout(() => finish(), timeoutMs);

    img.onload = () => {
      window.clearTimeout(t);
      finish();
    };

    img.onerror = () => {
      window.clearTimeout(t);
      finish();
    };

    // set handlers BEFORE src (avoids cached-image edge cases)
    img.src = url;
  });
}

function safeColor(v: any): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return undefined;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return undefined;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// ✅ Dark baseGradient that we can "fade" using an opacity multiplier.
// When darkness = 0 => gradient becomes transparent.
// When darkness = 1 => gradient is the original dark gradient.
function buildGradient(darkness: number) {
  const d = clamp01(darkness);

  // Original gradient alphas: 0.92 / 0.78 / 0.55
  const a1 = (0.92 * d).toFixed(3);
  const a2 = (0.78 * d).toFixed(3);
  const a3 = (0.55 * d).toFixed(3);

  return `linear-gradient(90deg, rgba(6,20,34,${a1}) 0%, rgba(6,20,34,${a2}) 55%, rgba(6,20,34,${a3}) 100%)`;
}

/**
 * HeroSlider (Responsive + immediate first paint)
 * - Uses server-provided initial slide data when available
 * - Keeps the Supabase refresh after hydration so admin edits still appear
 * - Does not block hero text on the first image preload
 *
 * Overlay behavior (requested):
 * ✅ Removed the overlay DIV.
 * ✅ Uses the built-in baseGradient overlay.
 * ✅ The admin slider controls the gradient "darkness":
 *    - overlay_opacity = 0 => NO overlay
 *    - overlay_opacity = 1 => FULL overlay
 */
export default function HeroSlider({ initialData }: { initialData?: InitialHeroData }) {
  const [settings, setSettings] = useState<HeroSettingsRow>(() => ({
    ...DEFAULT_HERO_SETTINGS,
    ...(initialData?.settings ?? {}),
  }));
  const [slides, setSlides] = useState<HeroSlideRow[]>(() => initialData?.slides ?? []);
  const [idx, setIdx] = useState(0);

  const [screen, setScreen] = useState<ScreenKind>(() => getScreenKind());

  // When initial data exists, the hero can paint with content before hydration finishes.
  const [ready, setReady] = useState(() => Boolean(initialData?.slides?.length));
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const hadInitialSlidesRef = useRef(Boolean(initialData?.slides?.length));

  // Track screen size
  useEffect(() => {
    function onResize() {
      setScreen(getScreenKind());
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Height tuning (mobile gets extra room so text never clips)
  const heightPx = useMemo(() => {
    const d = settings.height_desktop;
    const m = settings.height_mobile;

    if (screen === "mobile") return Math.max(m, 560);
    if (screen === "tablet") return Math.max(Math.round(m + (d - m) * 0.6), 520);
    return d;
  }, [screen, settings.height_desktop, settings.height_mobile]);

  // Load settings + slides from Supabase (and preload the first slide image)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hadInitialSlidesRef.current) {
        setReady(false);
      }

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

      const nextSlides: HeroSlideRow[] =
        !slErr && Array.isArray(sl) && sl.length > 0 ? (sl as HeroSlideRow[]) : [];

      setSlides(nextSlides);
      setIdx(0);

      if (nextSlides.length === 0) {
        setReady(false);
        return;
      }

      // Show content as soon as data exists; image loading should not make the hero feel blank.
      setReady(true);

      // Warm the first slide image, but do not block text/rendering on it.
      const firstUrl = nextSlides[0]?.image_url ? String(nextSlides[0].image_url) : "";
      void preloadImage(firstUrl, 1200);

      // Preload the rest in the background (doesn't block rendering)
      const rest = nextSlides
        .slice(1)
        .map((x) => (x?.image_url ? String(x.image_url) : ""))
        .filter(Boolean);

      for (const url of rest) {
        const img = new window.Image();
        img.src = url;
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
  const activeImageUrl = slide?.image_url ? String(slide.image_url) : "";
  const activeImageLoaded = Boolean(activeImageUrl && loadedImageUrl === activeImageUrl);

  // ✅ This is the "darkness" for the gradient overlay.
  const darkness =
    typeof slide?.overlay_opacity === "number"
      ? clamp01(slide.overlay_opacity)
      : clamp01(settings.overlay_opacity);

  const textAlignClass =
    settings.text_align === "left" ? "items-start text-left" : "items-center text-center";

  const bgStyle = useMemo(() => {
    const shellBg =
      "linear-gradient(135deg, #071b2e 0%, #051524 50%, #071b2e 100%)";

    if (ready && activeImageUrl) {
      const gradient = buildGradient(darkness);
      return {
        backgroundImage: `${gradient}, url(${activeImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } as React.CSSProperties;
    }

    // Shell/background while loading (no text)
    return {
      backgroundImage: shellBg,
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as React.CSSProperties;
  }, [ready, activeImageUrl, darkness]);

  useEffect(() => {
    if (!activeImageUrl) {
      setLoadedImageUrl(null);
      return;
    }

    let alive = true;
    setLoadedImageUrl((current) => (current === activeImageUrl ? current : null));

    preloadImage(activeImageUrl, 4000).then(() => {
      if (!alive) return;
      setLoadedImageUrl(activeImageUrl);
    });

    return () => {
      alive = false;
    };
  }, [activeImageUrl]);

  function prev() {
    setIdx((v) => clampIdx(v - 1));
  }

  function next() {
    setIdx((v) => clampIdx(v + 1));
  }

  // Auto-rotate (only when ready and multiple slides)
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!(ready && settings.auto_rotate)) return;
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
  }, [ready, settings.auto_rotate, settings.interval_ms, slides.length]);

  const showArrows = ready && settings.show_arrows && slides.length > 1 && screen !== "mobile";
  const arrowsOnDesktop = screen === "desktop";

  const arrowBase =
    "absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 text-white shadow-sm transition-none";
  const arrowVisibility = arrowsOnDesktop ? "opacity-0 group-hover:opacity-100" : "opacity-100";
  const arrowSize = "h-11 w-11 text-sm";

  const wrapPadding = screen === "mobile" ? "px-5 py-8" : "px-6 sm:px-12";
  const maxTextWidth = screen === "mobile" ? "max-w-[26rem]" : "max-w-3xl";

  const headlineCls =
    screen === "mobile" ? "text-[10px] tracking-[0.24em]" : "text-[11px] tracking-[0.28em]";

  const titleCls =
    screen === "mobile"
      ? "text-2xl leading-[1.06]"
      : "text-3xl sm:text-4xl md:text-5xl leading-tight";

  const bodyCls =
    screen === "mobile" ? "text-[13px] leading-[1.45]" : "text-sm sm:text-base leading-relaxed";

  const ctaCls = screen === "mobile" ? "px-6 py-2.5 text-sm" : "px-8 py-3 text-sm";

  const dotsBottom = screen === "mobile" ? "bottom-4" : "bottom-6";

  // ✅ Apply per-slide colors if present; otherwise fall back to existing styling
  const headlineColor = safeColor(slide?.headline_color) ?? "rgba(255,255,255,0.65)";
  const titleColor = safeColor(slide?.title_color) ?? settings.text_color;
  const bodyColor = safeColor(slide?.body_color); // if undefined, keep existing class color
  const ctaTextColor = safeColor(slide?.cta_text_color); // if undefined, keep black
  const hasHeroCopy = Boolean(
    (slide?.headline && slide.headline.trim()) ||
      (slide?.title && slide.title.trim()) ||
      (slide?.body && slide.body.trim())
  );
  const showBrandFallback = ready && hasSlides && !activeImageLoaded && !hasHeroCopy;

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8">
        <div
          className="group relative mx-auto w-full overflow-hidden rounded-[34px]"
          style={{
            height: `${heightPx}px`,
            minHeight: `${heightPx}px`,
            ...bgStyle,
          }}
        >
          {/* Content only when ready */}
          {ready && hasSlides ? (
            <div className={"relative z-10 flex h-full w-full flex-col justify-center " + wrapPadding}>
              <div className={`mx-auto flex w-full ${maxTextWidth} flex-col ${textAlignClass}`}>
                {showBrandFallback ? (
                  <div className="mx-auto mb-7 flex w-full max-w-md justify-center">
                    <Image
                      src="/logo.png"
                      alt="The Grind Baseball Lab"
                      width={720}
                      height={280}
                      priority
                      className="h-auto w-full max-w-[320px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] sm:max-w-[420px]"
                    />
                  </div>
                ) : null}

                {slide?.headline ? (
                  <div className={`${headlineCls} uppercase`} style={{ color: headlineColor }}>
                    {slide.headline}
                  </div>
                ) : null}

                {slide?.title ? (
                  <h1 className={`mt-3 sm:mt-4 font-semibold ${titleCls}`} style={{ color: titleColor }}>
                    {slide.title}
                  </h1>
                ) : null}

                {slide?.body ? (
                  <p
                    className={`mt-3 sm:mt-4 ${bodyCls} text-white/85 break-words ${
                      screen === "mobile" ? "line-clamp-6" : ""
                    }`}
                    style={bodyColor ? { color: bodyColor } : undefined}
                  >
                    {slide.body}
                  </p>
                ) : null}

                {slide?.cta_text ? (
                  <div className="mt-5 sm:mt-6">
                    <a
                      href={slide.cta_href || "#"}
                      className={`inline-flex items-center justify-center rounded-full bg-white font-medium text-black ${ctaCls}`}
                      style={ctaTextColor ? { color: ctaTextColor } : undefined}
                    >
                      {slide.cta_text}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Dots */}
          {ready && settings.show_dots && slides.length > 1 ? (
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
                        : `rounded-full bg-white/35 transition-none ${
                            screen === "mobile" ? "h-3 w-3" : "h-2 w-2"
                          }`
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
