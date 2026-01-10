"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NewsSlide = {
  id?: string;
  headline: string;
  title: string;
  body: string;
  right_label: string;
  right_image_url: string | null; // used as LEFT image in this layout
  cta_text: string;
  cta_href: string;
};

export default function NewsUpdatesSection() {
  const [slides, setSlides] = useState<NewsSlide[]>([]);
  const [idx, setIdx] = useState(0);

  // ✅ "No flash" gate (matches HeroSlider approach)
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  // Slider behavior
  const AUTO_ROTATE = true;
  const INTERVAL_MS = 3000;

  const timerRef = useRef<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  // Load rows from Supabase (admin-editable) + preload first image so we don't flash a "default" look
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setReady(false);

      const { data, error } = await supabase
        .from("news_slides")
        .select(
          "id, headline, title, body, right_label, right_image_url, cta_text, cta_href, is_active, sort_order"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(50);

      if (!alive) return;

      const mapped: NewsSlide[] =
        !error && Array.isArray(data) && data.length > 0
          ? data.map((r: any) => ({
              id: r.id,
              headline: r.headline ?? "",
              title: r.title ?? "",
              body: r.body ?? "",
              right_label: r.right_label ?? "THE GRIND BASEBALL LAB",
              right_image_url: r.right_image_url ?? null,
              cta_text: r.cta_text ?? "Learn more",
              cta_href: r.cta_href ?? "#",
            }))
          : [];

      setSlides(mapped);
      setIdx(0);
      setLoading(false);

      // No slides -> keep the section blank (no placeholder content)
      if (mapped.length === 0) {
        setReady(false);
        return;
      }

      // Preload all images (so slide changes won't flash)
      const urls = mapped
        .map((x) => (x?.right_image_url ? String(x.right_image_url) : ""))
        .filter(Boolean);

      for (const url of urls) {
        const img = new window.Image();
        img.src = url;
      }

      // Wait for the FIRST slide image (if any) before rendering the section content
      const firstUrl = mapped[0]?.right_image_url ? String(mapped[0].right_image_url) : "";
      if (!firstUrl) {
        setReady(true);
        return;
      }

      const firstImg = new window.Image();
      firstImg.src = firstUrl;

      firstImg.onload = () => {
        if (!alive) return;
        setReady(true);
      };
      firstImg.onerror = () => {
        if (!alive) return;
        // If it fails, still render (we'll show the gradient background)
        setReady(true);
      };
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const hasSlides = slides.length > 0;
  const safeIdx = Math.max(0, Math.min(idx, Math.max(0, slides.length - 1)));
  const active = hasSlides ? slides[safeIdx] : null;

  function clampIdx(next: number) {
    if (slides.length === 0) return 0;
    const n = slides.length;
    return (next + n) % n;
  }

  function prev() {
    if (slides.length <= 1) return;
    setIdx((v) => clampIdx(v - 1));
  }

  function next() {
    if (slides.length <= 1) return;
    setIdx((v) => clampIdx(v + 1));
  }

  // Auto-rotate (pauses on hover)
  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!AUTO_ROTATE) return;
    if (loading) return;
    if (!ready) return;
    if (isHovering) return;
    if (slides.length <= 1) return;

    timerRef.current = window.setInterval(() => {
      setIdx((v) => clampIdx(v + 1));
    }, INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [AUTO_ROTATE, INTERVAL_MS, loading, ready, isHovering, slides.length]);

  // Keyboard arrows (only when ready)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!ready) return;
      if (slides.length <= 1) return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, slides.length]);

  // Compute background style for LEFT image
  const leftBgStyle = useMemo(() => {
    if (ready && active?.right_image_url) {
      return {
        backgroundImage: `url(${active.right_image_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } as React.CSSProperties;
    }

    // Clean brand gradient if no image (or before ready)
    return {
      backgroundImage:
        "radial-gradient(circle at 20% 20%, rgba(31,162,255,0.75), transparent 45%), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.18), transparent 55%), linear-gradient(135deg, #061a2f 0%, #071b2e 55%, #000000 100%)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    } as React.CSSProperties;
  }, [ready, active?.right_image_url]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchDeltaX.current = 0;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX ?? touchStartX.current;
    touchDeltaX.current = x - touchStartX.current;
  }

  function onTouchEnd() {
    if (!ready) return;

    const dx = touchDeltaX.current;
    touchStartX.current = null;
    touchDeltaX.current = 0;

    // simple swipe threshold
    if (dx > 55) prev();
    else if (dx < -55) next();
  }

  const showContent = ready && hasSlides && !loading;

  return (
    <section className="bg-white text-black">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-center text-4xl sm:text-5xl md:text-6xl font-light tracking-wide text-black">
            NEWS AND UPDATES
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-black/60">
            Add as many slides as you want in Admin — this will rotate through them.
          </p>
        </div>

        <div className="relative mt-10">
          <div
            className="group overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* LEFT: image (or gradient while waiting) */}
              <div className="relative min-h-[260px] sm:min-h-[320px] md:min-h-[460px] bg-black">
                <div className="absolute inset-0" style={leftBgStyle} />
                <div className="absolute inset-0 bg-black/25" />

                {/* watermark label when no image */}
                {!showContent || !active?.right_image_url ? (
                  <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                    <div className="text-white/25 text-2xl sm:text-3xl font-extrabold italic tracking-tight">
                      {showContent ? active?.right_label || "THE GRIND BASEBALL LAB" : "THE GRIND BASEBALL LAB"}
                    </div>
                  </div>
                ) : null}

                {/* Top-left chip (only when ready/content) */}
                {showContent ? (
                  <div className="absolute left-5 top-5">
                    <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] uppercase text-white backdrop-blur">
                      {active?.headline || "UPDATE"}
                    </div>
                  </div>
                ) : null}

                {/* Mobile arrows (only when ready/content) */}
                {showContent && slides.length > 1 ? (
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between md:hidden">
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Previous update"
                      className="h-11 w-11 rounded-full border border-white/20 bg-white/10 text-white shadow-sm backdrop-blur transition hover:bg-white/15"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Next update"
                      className="h-11 w-11 rounded-full border border-white/20 bg-white/10 text-white shadow-sm backdrop-blur transition hover:bg-white/15"
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </div>

              {/* RIGHT: text */}
              <div className="p-6 sm:p-8 md:p-10">
                {!showContent ? (
                  <>
                    <div className="h-3 w-28 rounded bg-black/10" />
                    <div className="mt-4 h-10 w-5/6 rounded bg-black/10" />
                    <div className="mt-4 h-4 w-full rounded bg-black/10" />
                    <div className="mt-2 h-4 w-5/6 rounded bg-black/10" />
                    <div className="mt-2 h-4 w-4/6 rounded bg-black/10" />
                    <div className="mt-8 h-11 w-36 rounded-full bg-black/10" />
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl sm:text-3xl font-semibold leading-tight text-black">
                      {active?.title ?? ""}
                    </h3>

                    <div className="mt-4 text-sm sm:text-base leading-relaxed text-black/70 whitespace-pre-line">
                      {active?.body ?? ""}
                    </div>

                    <div className="mt-8">
                      <a
                        href={active?.cta_href || "#"}
                        className="inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      >
                        {active?.cta_text || "Learn more"}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Dots (only when ready/content) */}
            {showContent && slides.length > 1 ? (
              <div className="flex items-center justify-center gap-2 border-t border-black/10 bg-white py-5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to update ${i + 1}`}
                    onClick={() => setIdx(i)}
                    className={
                      i === safeIdx
                        ? "h-2 w-10 rounded-full bg-black"
                        : "h-2 w-2 rounded-full bg-black/25 hover:bg-black/40"
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Desktop arrows (only when ready/content) */}
          {showContent && slides.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous update"
                className="absolute top-1/2 -translate-y-1/2 left-2 sm:-left-10 md:-left-14 hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-black shadow-sm transition hover:-translate-y-[calc(50%+1px)] hover:bg-black/15"
              >
                ←
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="Next update"
                className="absolute top-1/2 -translate-y-1/2 right-2 sm:-right-10 md:-right-14 hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-black/10 text-black shadow-sm transition hover:-translate-y-[calc(50%+1px)] hover:bg-black/15"
              >
                →
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-14 h-px w-full bg-black/10" />
      </div>
    </section>
  );
}
