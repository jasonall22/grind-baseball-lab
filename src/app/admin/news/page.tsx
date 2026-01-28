"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type NewsSlideRow = {
  id: string;
  sort_order: number;
  headline: string;
  title: string;
  body: string;
  right_label: string;
  right_image_url: string | null;
  cta_text: string;
  cta_href: string;
  is_active: boolean;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function inputClass() {
  return "w-full rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25";
}

function textareaClass() {
  return "w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none focus:border-black/25";
}

function safeFileName(name: string) {
  const trimmed = (name || "").trim();
  const base = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  return base.length ? base : "image";
}

function normalizeHref(v: string) {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("#")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

// Bucket name (preferred: news-images). You can override with NEXT_PUBLIC_NEWS_BUCKET.
const NEWS_BUCKET =
  (process.env.NEXT_PUBLIC_NEWS_BUCKET && process.env.NEXT_PUBLIC_NEWS_BUCKET.trim()) || "news-images";

// Just-in-case casing differences if bucket was created with different casing.
const NEWS_BUCKET_CANDIDATES = [NEWS_BUCKET, "news-images", "NEWS-IMAGES"];

async function uploadNewsImage(file: File, path: string) {
  let lastError: any = null;

  for (const bucket of NEWS_BUCKET_CANDIDATES) {
    if (!bucket) continue;

    const up = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });

    if (!up.error) {
      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      return pub.data.publicUrl || "";
    }

    lastError = up.error;
  }

  throw lastError ?? new Error('Bucket not found. Create Storage bucket "news-images" and set it to Public.');
}

const MAX_CARDS_HINT = 3; // purely a label in UI, does not cap rows

export default function AdminNewsPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const [rows, setRows] = useState<NewsSlideRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Draft edits keyed by slide id (so you can type without it jumping)
  const [draft, setDraft] = useState<Record<string, Partial<NewsSlideRow>>>({});

  // One hidden file input we re-use (so we don't need 50 inputs)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadSlideIdRef = useRef<string | null>(null);

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

      const prof = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

      if (!prof.data || prof.data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (!alive) return;

      setIsAdmin(true);
      setChecking(false);

      await loadSlides();
    }

    void boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlides() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("news_slides")
      .select("id, sort_order, headline, title, body, right_label, right_image_url, cta_text, cta_href, is_active")
      .order("sort_order", { ascending: true })
      .limit(200);

    if (error) {
      setRows([]);
      setLoading(false);
      setError(
        "Could not load slides. Make sure the news_slides table exists and RLS policies are set."
      );
      return;
    }

    const next = (data as NewsSlideRow[]) ?? [];
    setRows(next);

    // If the selected slide no longer exists, go back to grid
    if (selectedId && !next.find((r) => r.id === selectedId)) {
      setSelectedId(null);
    }

    setLoading(false);
  }

  const sorted = useMemo(() => [...rows].sort((a, b) => a.sort_order - b.sort_order), [rows]);

  function getValue<T extends keyof NewsSlideRow>(id: string, key: T): NewsSlideRow[T] {
    const base = rows.find((r) => r.id === id);
    const d = draft[id] as any;
    if (d && key in d) return d[key];
    return (base as any)?.[key];
  }

  function setValue(id: string, patch: Partial<NewsSlideRow>) {
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }

  async function addSlide() {
    setError("");
    setSavingId("adding");

    const nextOrder = rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.sort_order || 0)) + 1;

    const { data, error } = await supabase
      .from("news_slides")
      .insert({
        sort_order: nextOrder,
        headline: "NEW UPDATE",
        title: "TITLE",
        body: "Write your update here.",
        right_label: "THE GRIND BASEBALL LAB",
        right_image_url: null,
        cta_text: "Learn more",
        cta_href: "#membership",
        is_active: true,
      })
      .select("id, sort_order, headline, title, body, right_label, right_image_url, cta_text, cta_href, is_active")
      .single();

    setSavingId(null);

    if (error || !data) {
      setError("Could not add slide.");
      return;
    }

    setRows((prev) => [...prev, data as NewsSlideRow].sort((a, b) => a.sort_order - b.sort_order));
    setSelectedId((data as any).id);
  }

  async function saveSlide(id: string) {
    setError("");
    setSavingId(id);

    try {
      const patch = draft[id] || {};
      const payload: Partial<NewsSlideRow> = {
        sort_order: typeof patch.sort_order === "number" ? patch.sort_order : undefined,
        is_active: typeof patch.is_active === "boolean" ? patch.is_active : undefined,
        headline: typeof patch.headline === "string" ? patch.headline : undefined,
        title: typeof patch.title === "string" ? patch.title : undefined,
        body: typeof patch.body === "string" ? patch.body : undefined,
        right_label: typeof patch.right_label === "string" ? patch.right_label : undefined,
        right_image_url: typeof patch.right_image_url === "string" ? patch.right_image_url.trim() : undefined,
        cta_text: typeof patch.cta_text === "string" ? patch.cta_text : undefined,
        cta_href: typeof patch.cta_href === "string" ? normalizeHref(patch.cta_href) : undefined,
      };

      Object.keys(payload).forEach((k) => {
        if ((payload as any)[k] === undefined) delete (payload as any)[k];
      });

      if (!Object.keys(payload).length) {
        setError("No changes to save for this slide.");
        return;
      }

      const { error } = await supabase.from("news_slides").update(payload).eq("id", id);
      if (error) {
        setError("Could not save. (Are you logged in as admin? Did you run the RLS SQL?)");
        return;
      }

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      await loadSlides();
    } finally {
      setSavingId(null);
    }
  }

  async function deleteSlide(id: string) {
    setError("");
    setDeletingId(id);

    try {
      const { error } = await supabase.from("news_slides").delete().eq("id", id);
      if (error) {
        setError("Could not delete.");
        return;
      }

      setDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setRows((prev) => prev.filter((r) => r.id !== id));
      if (selectedId === id) setSelectedId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function startUpload(slideId: string) {
    pendingUploadSlideIdRef.current = slideId;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function onFilePicked(file: File | null) {
    const slideId = pendingUploadSlideIdRef.current;
    pendingUploadSlideIdRef.current = null;

    if (!slideId) return;
    if (!file) return;

    setError("");
    setSavingId(slideId);

    try {
      const clean = safeFileName(file.name);
      const stamp = Date.now();
      const path = `news/${slideId}/${stamp}-${clean}`;

      const publicUrl = await uploadNewsImage(file, path);

      if (!publicUrl) {
        setError("Upload worked, but public URL was empty. Make sure the bucket is Public.");
        return;
      }

      // Save URL into the slide
      const { error: dbErr } = await supabase.from("news_slides").update({ right_image_url: publicUrl }).eq("id", slideId);

      if (dbErr) {
        setError("Uploaded, but could not save URL to the slide. (Check news_slides RLS policies.)");
        return;
      }

      // Update local state + draft
      setRows((prev) => prev.map((r) => (r.id === slideId ? { ...r, right_image_url: publicUrl } : r)));
      setDraft((prev) => {
        const next = { ...prev };
        if (next[slideId]) {
          next[slideId] = { ...next[slideId], right_image_url: publicUrl };
        }
        return next;
      });
    } catch (e: any) {
      setError(
        e?.message ||
          'Upload failed. Create a Storage bucket named "news-images" (Public) and run the storage policies SQL.'
      );
    } finally {
      setSavingId(null);
    }
  }

  async function clearImage(slideId: string) {
    setError("");
    setSavingId(slideId);

    try {
      const { error } = await supabase.from("news_slides").update({ right_image_url: null }).eq("id", slideId);
      if (error) {
        setError("Could not remove image.");
        return;
      }

      setRows((prev) => prev.map((r) => (r.id === slideId ? { ...r, right_image_url: null } : r)));
      setDraft((prev) => {
        const next = { ...prev };
        if (next[slideId]) {
          next[slideId] = { ...next[slideId], right_image_url: null };
        }
        return next;
      });
    } finally {
      setSavingId(null);
    }
  }

  const pageTitle = useMemo(() => {
    if (checking) return "Loading…";
    if (!isAdmin) return "Admin";
    return "News & Updates (Admin)";
  }, [checking, isAdmin]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) : null;

  // Loading shell
  if (checking || loading) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-black">{pageTitle}</h1>
          <div className="mt-6 rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">Loading…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hidden picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
          void onFilePicked(f);
        }}
      />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-black">{pageTitle}</h1>
            <p className="mt-1 text-sm text-black/60">
              Manage your News &amp; Updates slides. Click a card to edit. (Bucket: <b>{NEWS_BUCKET}</b>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
            >
              Back to Admin
            </button>

            <button
              type="button"
              onClick={addSlide}
              disabled={savingId === "adding"}
              className={classNames(
                "rounded-full px-4 py-2 text-sm font-semibold",
                savingId === "adding" ? "bg-black/40 text-white" : "bg-black text-white hover:bg-black/90"
              )}
            >
              {savingId === "adding" ? "Adding…" : "Add slide"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {/* GRID VIEW (like hero) */}
        {!selectedId ? (
          <div className="mt-8">
            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">
                No slides yet. Click “Add slide”.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((s, i) => {
                  const slideNo = i + 1;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className="text-left rounded-2xl border border-black/10 bg-[#f7f8fb] p-4 hover:border-black/30 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold tracking-[0.22em] text-black/60">
                          SLIDE {slideNo}
                        </div>

                        <div className={classNames(
                          "text-[11px] font-semibold tracking-[0.18em] uppercase",
                          s.is_active ? "text-emerald-700" : "text-black/35"
                        )}>
                          {s.is_active ? "ACTIVE" : "HIDDEN"}
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-black/10 bg-white overflow-hidden">
                        <div className="relative h-24 bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {s.right_image_url ? (
                            <img
                              src={s.right_image_url}
                              alt="Slide image"
                              className="absolute inset-0 h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/55">
                              No image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20" />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="text-sm font-semibold text-black line-clamp-1">
                          {s.title || "Untitled"}
                        </div>
                        <div className="mt-1 text-xs text-black/60 line-clamp-2">
                          {s.body || ""}
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-black/50">
                        Sort order: <span className="font-semibold text-black/70">{s.sort_order}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6 text-xs text-black/45">
              Tip: You can have more than {MAX_CARDS_HINT} slides. The homepage rotates through all active slides.
            </div>
          </div>
        ) : null}

        {/* EDIT VIEW (like hero) */}
        {selectedId ? (
          <div className="mt-8">
            {!selected ? (
              <div className="rounded-2xl border border-black/10 bg-white px-6 py-6 text-black/70">
                Slide not found.
              </div>
            ) : (
              <section className="rounded-2xl border border-black/10 bg-[#f7f8fb] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold tracking-[0.22em] text-black/60">
                    EDIT SLIDE
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-sm font-medium text-black/70 hover:underline"
                    >
                      Back to cards
                    </button>

                    <label className="flex items-center gap-2 text-sm text-black/70">
                      <input
                        type="checkbox"
                        checked={!!getValue(selected.id, "is_active")}
                        onChange={(e) => setValue(selected.id, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-black/30"
                      />
                      Active
                    </label>

                    <button
                      type="button"
                      disabled={deletingId === selected.id}
                      onClick={() => deleteSlide(selected.id)}
                      className={classNames(
                        "text-sm font-medium",
                        deletingId === selected.id ? "text-black/30" : "text-red-600 hover:underline"
                      )}
                    >
                      {deletingId === selected.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Row 1 */}
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-black/60">Headline (chip)</label>
                    <input
                      value={(getValue(selected.id, "headline") as any) ?? ""}
                      onChange={(e) => setValue(selected.id, { headline: e.target.value })}
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black/60">Sort order</label>
                    <input
                      inputMode="numeric"
                      value={String(getValue(selected.id, "sort_order") ?? 1)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setValue(selected.id, { sort_order: Number.isFinite(n) ? n : 1 });
                      }}
                      className={inputClass()}
                    />
                  </div>
                </div>

                {/* Title */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Title</label>
                  <input
                    value={(getValue(selected.id, "title") as any) ?? ""}
                    onChange={(e) => setValue(selected.id, { title: e.target.value })}
                    className={inputClass()}
                  />
                </div>

                {/* Body */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">Body</label>
                  <textarea
                    value={(getValue(selected.id, "body") as any) ?? ""}
                    onChange={(e) => setValue(selected.id, { body: e.target.value })}
                    rows={4}
                    className={textareaClass()}
                  />
                </div>

                {/* Label + CTA row */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-black/60">Right label (watermark)</label>
                    <input
                      value={(getValue(selected.id, "right_label") as any) ?? ""}
                      onChange={(e) => setValue(selected.id, { right_label: e.target.value })}
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black/60">CTA button text</label>
                    <input
                      value={(getValue(selected.id, "cta_text") as any) ?? ""}
                      onChange={(e) => setValue(selected.id, { cta_text: e.target.value })}
                      className={inputClass()}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-black/60">CTA link (href)</label>
                  <input
                    value={(getValue(selected.id, "cta_href") as any) ?? ""}
                    onChange={(e) => setValue(selected.id, { cta_href: e.target.value })}
                    className={inputClass()}
                    placeholder="#membership or https://..."
                  />
                </div>

                {/* Image upload */}
                <div className="mt-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-medium text-black/60">Image (left side on homepage)</div>
                      <div className="mt-1 text-xs text-black/45">
                        Uploads to Supabase Storage bucket: <b>{NEWS_BUCKET}</b>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingId === selected.id}
                        onClick={() => startUpload(selected.id)}
                        className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
                      >
                        {savingId === selected.id ? "Working…" : "Upload image"}
                      </button>

                      <button
                        type="button"
                        disabled={savingId === selected.id}
                        onClick={() => clearImage(selected.id)}
                        className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white p-3">
                    {(() => {
                      const url = (getValue(selected.id, "right_image_url") as any) ?? null;
                      return url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="Slide image" className="h-40 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center rounded-xl bg-black/5 text-sm text-black/50">
                          No image yet
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Save */}
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={savingId === selected.id}
                    onClick={() => saveSlide(selected.id)}
                    className={classNames(
                      "rounded-full px-5 py-2 text-sm font-semibold text-white",
                      savingId === selected.id ? "bg-black/40" : "bg-black hover:bg-black/90"
                    )}
                  >
                    {savingId === selected.id ? "Saving…" : "Save slide"}
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : null}

        <div className="mt-10 h-px w-full bg-black/10" />
      </div>
    </main>
  );
}
