"use client";

import { useEffect, useMemo, useState } from "react";
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

// We try both bucket ids just in case your bucket was created with different casing.
const HERO_BUCKET_CANDIDATES = ["hero-images", "HERO-IMAGES"];

async function uploadHeroImage(file: File) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ext.match(/^[a-z0-9]+$/) ? ext : "png";
  const path = `${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExt}`;

  let lastError: any = null;

  for (const bucket of HERO_BUCKET_CANDIDATES) {
    const up = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (!up.error) {
      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      // getPublicUrl never "fails" but may return an empty string if misconfigured.
      return pub.data.publicUrl || "";
    }

    lastError = up.error;
  }

  throw lastError ?? new Error("Upload failed");
}

const MAX_SLIDES = 3;

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

  const slideCount = slides.length;

  const canAdd = slideCount < MAX_SLIDES;

  useEffect(() => {
    let alive = true;

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

      if (!alive) return;

      setIsAdmin(true);
      setChecking(false);

      await loadSlides();
    }

    boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlides() {
    setLoading(true);
    setError("");

    const res = await supabase
      .from("hero_slides")
      .select("id, sort_order, is_active, headline, title, body, cta_text, cta_href, image_url")
      .order("sort_order", { ascending: true }) as any;

    if (res.error) {
      setError(res.error.message || "Could not load slides.");
      setSlides([]);
      setLoading(false);
      return;
    }

    setSlides((res.data || []) as HeroSlideRow[]);
    setLoading(false);
  }

  function getValue<T extends keyof HeroSlideRow>(id: string, key: T): HeroSlideRow[T] {
    const base = slides.find((s) => s.id === id);
    const d = draft[id] as any;
    if (d && key in d) return d[key];
    return (base as any)?.[key];
  }

  function setValue(id: string, patch: Partial<HeroSlideRow>) {
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  async function saveSlide(id: string) {
    setSavingId(id);
    setError("");

    const patch = draft[id] || {};
    const payload: Partial<HeroSlideRow> = {
      sort_order: typeof patch.sort_order === "number" ? patch.sort_order : undefined,
      is_active: typeof patch.is_active === "boolean" ? patch.is_active : undefined,
      headline: typeof patch.headline === "string" ? patch.headline : undefined,
      title: typeof patch.title === "string" ? patch.title : undefined,
      body: typeof patch.body === "string" ? patch.body : undefined,
      cta_text: typeof patch.cta_text === "string" ? patch.cta_text : undefined,
      cta_href: typeof patch.cta_href === "string" ? normalizeHref(patch.cta_href) : undefined,
      image_url: typeof patch.image_url === "string" ? patch.image_url : undefined,
    };

    // Remove undefined keys (so we don't overwrite with undefined)
    Object.keys(payload).forEach((k) => {
      if ((payload as any)[k] === undefined) delete (payload as any)[k];
    });

    const res = await supabase.from("hero_slides").update(payload).eq("id", id);

    if (res.error) {
      setError(res.error.message || "Could not save slide.");
      setSavingId(null);
      return;
    }

    // Clear draft for this slide (we saved it)
    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    await loadSlides();
    setSavingId(null);
  }

  async function addSlide() {
    setError("");

    if (!canAdd) return;

    const sort = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 1;

    const insert: Partial<HeroSlideRow> = {
      sort_order: sort,
      is_active: true,
      headline: "",
      title: "",
      body: "",
      cta_text: "",
      cta_href: "",
      image_url: null,
    };

    const res = await supabase.from("hero_slides").insert(insert).select("*").single();

    if (res.error) {
      setError(res.error.message || "Could not add slide.");
      return;
    }

    await loadSlides();
  }

  async function deleteSlide(id: string) {
    setDeletingId(id);
    setError("");

    const res = await supabase.from("hero_slides").delete().eq("id", id);

    if (res.error) {
      setError(res.error.message || "Could not delete slide.");
      setDeletingId(null);
      return;
    }

    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    await loadSlides();
    setDeletingId(null);
  }

  async function onPickImage(id: string, file: File | null) {
    if (!file) return;
    setSavingId(id);
    setError("");

    try {
      const url = await uploadHeroImage(file);
      if (!url) {
        setError("Upload worked, but public URL was empty. Check bucket is Public.");
        setSavingId(null);
        return;
      }

      // Save directly so it's immediate
      const res = await supabase.from("hero_slides").update({ image_url: url }).eq("id", id);
      if (res.error) {
        setError(res.error.message || "Could not save image.");
        setSavingId(null);
        return;
      }

      await loadSlides();
    } catch (e: any) {
      setError(e?.message || "Upload failed.");
    } finally {
      setSavingId(null);
    }
  }

  const pageTitle = useMemo(() => {
    if (checking) return "Loading…";
    if (!isAdmin) return "Admin";
    return "Hero Slider (Admin)";
  }, [checking, isAdmin]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-black">{pageTitle}</h1>
            <p className="mt-1 text-sm text-black/60">
              Edit up to {MAX_SLIDES} slides. Changes show on the home page hero.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
          >
            Back to Admin
          </button>
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

          {!loading && slides.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">
              No slides yet. Click “Add slide”.
            </div>
          ) : null}

          {slides.map((s, idx) => {
            const slideNo = idx + 1;
            const isSaving = savingId === s.id;
            const isDeleting = deletingId === s.id;

            return (
              <section key={s.id} className="rounded-2xl border border-black/10 bg-[#f7f8fb] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold tracking-[0.22em] text-black/60">
                    SLIDE {slideNo}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-black/70">
                      <input
                        type="checkbox"
                        checked={!!getValue(s.id, "is_active")}
                        onChange={(e) => setValue(s.id, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-black/30"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => deleteSlide(s.id)}
                      className={classNames(
                        "text-sm font-medium",
                        isDeleting ? "text-black/30" : "text-red-600 hover:underline"
                      )}
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Row 1 */}
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-black/60">
                      Topic label (e.g. “News & Updates”)
                    </label>
                    <input
                      value={(getValue(s.id, "headline") as any) ?? ""}
                      onChange={(e) => setValue(s.id, { headline: e.target.value })}
                      className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black/60">Sort order (1–3)</label>
                    <input
                      inputMode="numeric"
                      value={String(getValue(s.id, "sort_order") ?? 1)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setValue(s.id, { sort_order: Number.isFinite(n) ? n : 1 });
                      }}
                      className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Title (headline)</label>
                  <input
                    value={(getValue(s.id, "title") as any) ?? ""}
                    onChange={(e) => setValue(s.id, { title: e.target.value })}
                    className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Description */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Description</label>
                  <textarea
                    value={(getValue(s.id, "body") as any) ?? ""}
                    onChange={(e) => setValue(s.id, { body: e.target.value })}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                  />
                </div>

                {/* Button row */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-black/60">
                      Button label (e.g. “Learn More”)
                    </label>
                    <input
                      value={(getValue(s.id, "cta_text") as any) ?? ""}
                      onChange={(e) => setValue(s.id, { cta_text: e.target.value })}
                      className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black/60">
                      Button link (page path, e.g. “/teams”)
                    </label>
                    <input
                      value={(getValue(s.id, "cta_href") as any) ?? ""}
                      onChange={(e) => setValue(s.id, { cta_href: e.target.value })}
                      className="mt-2 w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25"
                    />
                  </div>
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
                        onChange={(e) => onPickImage(s.id, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image_url}
                        alt="Slide image"
                        className="h-40 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-xl bg-black/5 text-sm text-black/50">
                        No image yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Save */}
                <div className="mt-5">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => saveSlide(s.id)}
                    className={classNames(
                      "rounded-full px-5 py-2 text-sm font-semibold text-white",
                      isSaving ? "bg-black/40" : "bg-[#0b1b33] hover:bg-black"
                    )}
                  >
                    {isSaving ? "Saving…" : "Save slide"}
                  </button>
                </div>
              </section>
            );
          })}

          <div className="pt-2">
            <button
              type="button"
              onClick={addSlide}
              disabled={!canAdd}
              className={classNames(
                "rounded-full border px-5 py-2 text-sm font-semibold",
                canAdd
                  ? "border-black/15 bg-white text-black hover:bg-black/5"
                  : "border-black/10 bg-white text-black/30"
              )}
            >
              Add slide
            </button>

            <div className="mt-2 text-xs text-black/45">
              {canAdd ? "" : `Maximum of ${MAX_SLIDES} slides reached`}
            </div>
          </div>
        </div>

        <div className="mt-10 h-px w-full bg-black/10" />
      </div>
    </main>
  );
}
