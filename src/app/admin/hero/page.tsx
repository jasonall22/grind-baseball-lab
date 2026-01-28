"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
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

  // ✅ New (optional) per-line colors
  headline_color?: string | null;
  title_color?: string | null;
  body_color?: string | null;
  cta_text_color?: string | null;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function normalizeHref(v: string) {
  const s = (v ?? "").trim();
  if (!s) return "";
  // allow absolute urls or #anchors, otherwise force leading slash
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("#")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeColor(v: string) {
  const s = (v ?? "").trim();
  if (!s) return "";
  // accept #RGB or #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  return "";
}

// ✅ Bucket name can be configured without code changes.
// If not set, we default to "hero-images".
const HERO_BUCKET_PRIMARY = (process.env.NEXT_PUBLIC_HERO_BUCKET || "hero-images").trim();

// We try a few common variants for safety (your UI stays the same).
const HERO_BUCKET_CANDIDATES = Array.from(
  new Set(
    [
      HERO_BUCKET_PRIMARY,
      "hero-images",
      "hero_images",
      "hero",
      "heroes",
      "images",
      "public",
    ].filter(Boolean)
  )
);

async function uploadHeroImage(file: File) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ext.match(/^[a-z0-9]+$/) ? ext : "png";
  const path = `hero/${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

  let lastError: any = null;

  for (const bucket of HERO_BUCKET_CANDIDATES) {
    const up = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (!up.error) {
      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub.data.publicUrl || "";
      if (!url) {
        throw new Error(
          `Upload succeeded but URL was empty. Make the "${bucket}" bucket Public in Supabase Storage.`
        );
      }
      return url;
    }

    lastError = up.error;
  }

  const msg = String(lastError?.message || lastError || "Upload failed");
  if (msg.toLowerCase().includes("bucket") && msg.toLowerCase().includes("not found")) {
    throw new Error(
      `Bucket not found. Create a Storage bucket named "${HERO_BUCKET_PRIMARY}" (recommended) and set it to Public, or set NEXT_PUBLIC_HERO_BUCKET to your existing bucket name.`
    );
  }

  throw lastError ?? new Error("Upload failed");
}

const MAX_SLIDES = 3;
const REQUEST_TIMEOUT_MS = 12000;

async function postJSON<T>(url: string, body?: any): Promise<T> {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data as T;
  } finally {
    window.clearTimeout(t);
  }
}

type ViewMode = "grid" | "edit";

function ColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = normalizeColor(value) || "#000000";

  return (
    <div className="mt-2 flex items-center gap-3">
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 cursor-pointer rounded-md border border-black/10 bg-white p-0"
        aria-label="Pick color"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="h-9 w-28 rounded-full border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/25"
        aria-label="Hex color"
      />
      <div className="text-xs text-black/45">Example: #0b1b33</div>
    </div>
  );
}

export default function AdminHeroPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [slides, setSlides] = useState<HeroSlideRow[]>([]);

  // Draft edits keyed by slide id (so you can type without it jumping)
  const [draft, setDraft] = useState<Record<string, Partial<HeroSlideRow>>>({});

  // ✅ New UI: 3 small cards (Slide 1/2/3), click to open editor for that slide
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    async function boot() {
      setChecking(true);
      setError("");

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const prof = await supabase
        .from("profiles")
        .select("id, role, first_name, last_name, full_name")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (!prof.data || prof.data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (!aliveRef.current) return;

      setIsAdmin(true);
      setChecking(false);

      await loadSlides();
    }

    boot();

    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlides() {
    setLoading(true);
    setError("");

    const res = (await supabase
      .from("hero_slides")
      .select(
        "id, sort_order, is_active, headline, title, body, cta_text, cta_href, image_url, overlay_opacity, headline_color, title_color, body_color, cta_text_color"
      )
      .order("sort_order", { ascending: true })) as any;

    if (res.error) {
      setError(res.error.message || "Could not load slides.");
      setSlides([]);
      setLoading(false);
      return;
    }

    setSlides((res.data || []) as HeroSlideRow[]);
    setLoading(false);
  }

  const slidesBySlot = useMemo(() => {
    const map = new Map<number, HeroSlideRow>();
    for (const s of slides) {
      const slot = clampInt(Number(s.sort_order), 1, MAX_SLIDES);
      if (!map.has(slot)) map.set(slot, s);
    }
    return map;
  }, [slides]);

  function getValue<T extends keyof HeroSlideRow>(id: string, key: T): HeroSlideRow[T] {
    const base = slides.find((s) => s.id === id);
    const d = draft[id] as any;
    if (d && key in d) return d[key];
    return (base as any)?.[key];
  }

  function setValue(id: string, patch: Partial<HeroSlideRow>) {
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  function openGrid() {
    setView("grid");
    setSelectedId(null);
    setSelectedSlot(null);
    setError("");
  }

  function openSlideEditor(slot: number, id: string) {
    setSelectedSlot(slot);
    setSelectedId(id);
    setView("edit");
    setError("");
  }

  async function saveSlide(id: string) {
    setSavingId(id);
    setError("");

    try {
      const patch = draft[id] || {};
      const payload: Partial<HeroSlideRow> = {
        sort_order: typeof patch.sort_order === "number" ? clampInt(patch.sort_order, 1, 999) : undefined,
        is_active: typeof patch.is_active === "boolean" ? patch.is_active : undefined,
        headline: typeof patch.headline === "string" ? patch.headline : undefined,
        title: typeof patch.title === "string" ? patch.title : undefined,
        body: typeof patch.body === "string" ? patch.body : undefined,
        cta_text: typeof patch.cta_text === "string" ? patch.cta_text : undefined,
        cta_href: typeof patch.cta_href === "string" ? normalizeHref(patch.cta_href) : undefined,
        image_url: typeof patch.image_url === "string" ? patch.image_url : undefined,
        overlay_opacity:
          typeof patch.overlay_opacity === "number" && Number.isFinite(patch.overlay_opacity)
            ? Math.max(0, Math.min(1, patch.overlay_opacity))
            : undefined,


        // ✅ Colors
        headline_color: typeof patch.headline_color === "string" ? normalizeColor(patch.headline_color) || null : undefined,
        title_color: typeof patch.title_color === "string" ? normalizeColor(patch.title_color) || null : undefined,
        body_color: typeof patch.body_color === "string" ? normalizeColor(patch.body_color) || null : undefined,
        cta_text_color: typeof patch.cta_text_color === "string" ? normalizeColor(patch.cta_text_color) || null : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if ((payload as any)[k] === undefined) delete (payload as any)[k];
      });

      if (!Object.keys(payload).length) {
        setError("");
        return;
      }

      await postJSON<{ ok: true }>("/api/admin/hero/save", { id, payload });

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await loadSlides();
    } catch (e: any) {
      setError(
        e?.name === "AbortError"
          ? "Save slide timed out after 12s"
          : e?.message || "Could not save slide."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function addSlideIntoSlot(slot: number) {
    setError("");
    setSavingId("adding");

    try {
      const res = await postJSON<{ ok: true; id?: string | null }>("/api/admin/hero/add", {
        preferred_sort_order: slot,
      });

      await loadSlides();

      if (res?.id) {
        openSlideEditor(slot, res.id);
        return;
      }

      const s = slidesBySlot.get(slot);
      if (s) openSlideEditor(slot, s.id);
    } catch (e: any) {
      setError(
        e?.name === "AbortError"
          ? "Add slide timed out after 12s"
          : e?.message || "Could not add slide."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSlide(id: string) {
    setDeletingId(id);
    setError("");

    try {
      await postJSON<{ ok: true }>("/api/admin/hero/delete", { id });

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await loadSlides();
      openGrid();
    } catch (e: any) {
      setError(
        e?.name === "AbortError"
          ? "Delete slide timed out after 12s"
          : e?.message || "Could not delete slide."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function onPickImage(id: string, file: File | null) {
    if (!file) return;
    setSavingId(id);
    setError("");

    try {
      const url = await uploadHeroImage(file);
      await postJSON<{ ok: true }>("/api/admin/hero/save", { id, payload: { image_url: url } });
      await loadSlides();
    } catch (e: any) {
      setError(
        e?.name === "AbortError"
          ? "Save image timed out after 12s"
          : e?.message || "Upload/save failed."
      );
    } finally {
      setSavingId(null);
    }
  }

  const pageTitle = useMemo(() => {
    if (checking) return "Loading…";
    if (!isAdmin) return "Admin";
    return "Hero Slider (Admin)";
  }, [checking, isAdmin]);

  const selectedSlide = useMemo(() => {
    if (!selectedId) return null;
    return slides.find((s) => s.id === selectedId) || null;
  }, [selectedId, slides]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-black">{pageTitle}</h1>
            <p className="mt-1 text-sm text-black/60">
              {view === "grid"
                ? `Click a slide to edit. Up to ${MAX_SLIDES} slides.`
                : `Editing slide ${selectedSlot ?? ""}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {view === "edit" ? (
              <button
                type="button"
                onClick={openGrid}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
              >
                Back
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
            >
              Back to Admin
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-8 space-y-8">
          {loading ? (
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">
              Loading slides…
            </div>
          ) : null}

          {/* ✅ GRID VIEW: 3 small cards */}
          {!loading && view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((slot) => {
                const s = slidesBySlot.get(slot);
                const isEmpty = !s;

                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      if (s) openSlideEditor(slot, s.id);
                      else addSlideIntoSlot(slot);
                    }}
                    disabled={savingId === "adding"}
                    className={classNames(
                      "text-left rounded-2xl border p-5 transition",
                      "border-black/10 hover:border-black/30",
                      savingId === "adding" ? "opacity-60" : ""
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold tracking-[0.22em] text-black/60">
                        SLIDE {slot}
                      </div>

                      {s ? (
                        <div className="text-xs font-medium text-black/50">
                          {s.is_active ? "Active" : "Inactive"}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-black/40">
                          {savingId === "adding" ? "Adding…" : "Empty"}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <div className="font-semibold text-black">
                        {s?.title?.trim() ? s.title : isEmpty ? "Add slide" : "Untitled"}
                      </div>
                      <div className="mt-1 text-sm text-black/60 line-clamp-2">
                        {s?.headline?.trim()
                          ? s.headline
                          : isEmpty
                          ? "Click to create and edit this slide."
                          : "Click to edit this slide."}
                      </div>
                    </div>

                    {s?.image_url ? (
                      <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.image_url}
                          alt="Slide preview"
                          className="h-24 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 flex h-24 w-full items-center justify-center rounded-xl bg-black/5 text-xs text-black/45">
                        No image
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* ✅ EDIT VIEW */}
          {!loading && view === "edit" ? (
            selectedSlide ? (
              <section className="rounded-2xl border border-black/10 bg-[#f7f8fb] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold tracking-[0.22em] text-black/60">
                    SLIDE {selectedSlot ?? ""}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-black/70">
                      <input
                        type="checkbox"
                        checked={!!getValue(selectedSlide.id, "is_active")}
                        onChange={(e) => setValue(selectedSlide.id, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-black/30"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      disabled={deletingId === selectedSlide.id}
                      onClick={() => deleteSlide(selectedSlide.id)}
                      className={classNames(
                        "text-sm font-medium",
                        deletingId === selectedSlide.id ? "text-black/30" : "text-red-600 hover:underline"
                      )}
                    >
                      {deletingId === selectedSlide.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Topic label */}
                <div className="mt-5">
                  <label className="block text-xs font-medium text-black/60">
                    Topic label (e.g. “News & Updates”)
                  </label>
                  <ColorControl
                    value={String(getValue(selectedSlide.id, "headline_color") ?? "")}
                    onChange={(v) => setValue(selectedSlide.id, { headline_color: v })}
                  />
                  <input
                    value={(getValue(selectedSlide.id, "headline") as any) ?? ""}
                    onChange={(e) => setValue(selectedSlide.id, { headline: e.target.value })}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Sort order */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Sort order (1–3)</label>
                  <input
                    inputMode="numeric"
                    value={String(getValue(selectedSlide.id, "sort_order") ?? 1)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setValue(selectedSlide.id, { sort_order: Number.isFinite(n) ? n : 1 });
                    }}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>


                {/* Overlay darkness */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">
                    Overlay darkness
                  </label>

                  <div className="mt-2 flex items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={(() => {
                        // Stored as opacity (0 = none, 1 = full). UI shows "No overlay" at 100%.
                        const v = getValue(selectedSlide.id, "overlay_opacity") as any;
                        const opacity = typeof v === "number" && Number.isFinite(v) ? v : 0.45;
                        const pctNoOverlay = Math.round((1 - Math.max(0, Math.min(1, opacity))) * 100);
                        return pctNoOverlay;
                      })()}
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const safePct = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 55;
                        const opacity = 1 - safePct / 100; // 100% => 0 opacity (no overlay)
                        setValue(selectedSlide.id, {
                          overlay_opacity: Math.max(0, Math.min(1, opacity)),
                        });
                      }}
                      className="w-full"
                      aria-label="Overlay (100% = none)"
                    />

                    <div className="w-14 text-right text-xs font-medium text-black/60 tabular-nums">
                      {(() => {
                        const v = getValue(selectedSlide.id, "overlay_opacity") as any;
                        const opacity = typeof v === "number" && Number.isFinite(v) ? v : 0.45;
                        const pctNoOverlay = Math.round((1 - Math.max(0, Math.min(1, opacity))) * 100);
                        return `${pctNoOverlay}%`;
                      })()}
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-black/45">
                    Higher = darker overlay on the hero image.
                  </div>
                </div>

                {/* Title */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Title (headline)</label>
                  <ColorControl
                    value={String(getValue(selectedSlide.id, "title_color") ?? "")}
                    onChange={(v) => setValue(selectedSlide.id, { title_color: v })}
                  />
                  <input
                    value={(getValue(selectedSlide.id, "title") as any) ?? ""}
                    onChange={(e) => setValue(selectedSlide.id, { title: e.target.value })}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Description */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Description</label>
                  <ColorControl
                    value={String(getValue(selectedSlide.id, "body_color") ?? "")}
                    onChange={(v) => setValue(selectedSlide.id, { body_color: v })}
                  />
                  <textarea
                    value={(getValue(selectedSlide.id, "body") as any) ?? ""}
                    onChange={(e) => setValue(selectedSlide.id, { body: e.target.value })}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Button label */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">
                    Button label (e.g. “Learn More”)
                  </label>
                  <ColorControl
                    value={String(getValue(selectedSlide.id, "cta_text_color") ?? "")}
                    onChange={(v) => setValue(selectedSlide.id, { cta_text_color: v })}
                  />
                  <input
                    value={(getValue(selectedSlide.id, "cta_text") as any) ?? ""}
                    onChange={(e) => setValue(selectedSlide.id, { cta_text: e.target.value })}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Button link */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">
                    Button link (page path, e.g. “/teams”)
                  </label>
                  <input
                    value={(getValue(selectedSlide.id, "cta_href") as any) ?? ""}
                    onChange={(e) => setValue(selectedSlide.id, { cta_href: e.target.value })}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Image upload */}
                <div className="mt-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-medium text-black/60">Right-side image</div>

                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5">
                      Upload image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickImage(selectedSlide.id, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
                    {selectedSlide.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedSlide.image_url}
                        alt="Slide image"
                        className="h-40 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-xl bg-black/5 text-sm text-black/50">
                        No image yet
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-black/45">
                    Storage bucket:{" "}
                    <span className="font-medium text-black/60">{HERO_BUCKET_PRIMARY}</span>
                  </div>
                </div>

                {/* Save */}
                <div className="mt-5">
                  <button
                    type="button"
                    disabled={savingId === selectedSlide.id}
                    onClick={() => saveSlide(selectedSlide.id)}
                    className={classNames(
                      "rounded-full px-5 py-2 text-sm font-semibold text-white",
                      savingId === selectedSlide.id ? "bg-black/40" : "bg-[#0b1b33] hover:bg-black"
                    )}
                  >
                    {savingId === selectedSlide.id ? "Saving…" : "Save slide"}
                  </button>
                </div>
              </section>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">
                Slide not found. Go back and select a slide.
              </div>
            )
          ) : null}

          <div className="mt-10 h-px w-full bg-black/10" />
        </div>
      </div>
    </main>
  );
}
