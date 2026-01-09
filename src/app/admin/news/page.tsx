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

function inputClass() {
  return "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none";
}

function safeFileName(name: string) {
  const trimmed = (name || "").trim();
  const base = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  return base.length ? base : "image";
}

export default function AdminNewsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<NewsSlideRow[]>([]);

  // One hidden file input we re-use (so we don't need 50 inputs)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadSlideIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setStatus(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (profErr || !prof || prof.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      await loadSlides();
      if (!alive) return;

      setLoading(false);
    }

    boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlides() {
    setStatus(null);

    const { data, error } = await supabase
      .from("news_slides")
      .select(
        "id, sort_order, headline, title, body, right_label, right_image_url, cta_text, cta_href, is_active"
      )
      .order("sort_order", { ascending: true })
      .limit(50);

    if (error) {
      setRows([]);
      setStatus("Could not load slides. Make sure you ran Step 19 SQL (and Step 21 SQL for uploads).");
      return;
    }

    setRows((data as NewsSlideRow[]) ?? []);
  }

  function updateRow(id: string, patch: Partial<NewsSlideRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function addSlide() {
    setStatus(null);
    setSavingId("new");

    const nextOrder =
      rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.sort_order || 0)) + 1;

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
      .select(
        "id, sort_order, headline, title, body, right_label, right_image_url, cta_text, cta_href, is_active"
      )
      .single();

    setSavingId(null);

    if (error || !data) {
      setStatus("Could not add slide.");
      return;
    }

    setRows((prev) => [...prev, data as NewsSlideRow].sort((a, b) => a.sort_order - b.sort_order));
    setStatus("Added.");
  }

  async function saveSlide(id: string) {
    setStatus(null);
    setSavingId(id);

    const row = rows.find((r) => r.id === id);
    if (!row) {
      setSavingId(null);
      return;
    }

    const { error } = await supabase
      .from("news_slides")
      .update({
        sort_order: row.sort_order,
        headline: row.headline,
        title: row.title,
        body: row.body,
        right_label: row.right_label,
        right_image_url: row.right_image_url?.trim() ? row.right_image_url.trim() : null,
        cta_text: row.cta_text,
        cta_href: row.cta_href,
        is_active: row.is_active,
      })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      setStatus("Could not save. (Are you logged in as admin?)");
      return;
    }

    setStatus("Saved.");
    setRows((prev) => [...prev].sort((a, b) => a.sort_order - b.sort_order));
  }

  async function deleteSlide(id: string) {
    setStatus(null);
    setSavingId(id);

    const { error } = await supabase.from("news_slides").delete().eq("id", id);

    setSavingId(null);

    if (error) {
      setStatus("Could not delete.");
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== id));
    setStatus("Deleted.");
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

    setStatus(null);
    setSavingId(slideId);

    // Put files in a clean folder per slide.
    const clean = safeFileName(file.name);
    const ext = clean.includes(".") ? clean.split(".").pop() : "";
    const stamp = Date.now();
    const path = `news/${slideId}/${stamp}-${clean}`;

    // Upload to Supabase Storage bucket: news-images
    const { error: upErr } = await supabase.storage
      .from("news-images")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      setSavingId(null);
      setStatus(
        "Upload failed. Make sure you ran Step 21 SQL (bucket + policies). Then try again."
      );
      return;
    }

    // Get public URL (bucket is public)
    const { data: urlData } = supabase.storage.from("news-images").getPublicUrl(path);
    const publicUrl = urlData?.publicUrl ?? null;

    // Save URL into the row (database)
    const { error: dbErr } = await supabase
      .from("news_slides")
      .update({ right_image_url: publicUrl })
      .eq("id", slideId);

    setSavingId(null);

    if (dbErr) {
      setStatus("Uploaded, but could not save URL to the slide.");
      return;
    }

    updateRow(slideId, { right_image_url: publicUrl });
    setStatus("Uploaded!");
  }

  async function clearImage(slideId: string) {
    setStatus(null);
    setSavingId(slideId);

    const { error } = await supabase
      .from("news_slides")
      .update({ right_image_url: null })
      .eq("id", slideId);

    setSavingId(null);

    if (error) {
      setStatus("Could not remove image.");
      return;
    }

    updateRow(slideId, { right_image_url: null });
    setStatus("Removed.");
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order),
    [rows]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="text-xl font-semibold">Loading…</div>
          <div className="mt-2 text-sm text-black/60">
            If this takes too long, tell me and we’ll start a New Page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
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

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin — News & Updates</h1>
            <p className="mt-2 text-sm text-black/60">
              Edit slider text here. You can also upload a real image for the right side.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={addSlide}
              className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
              disabled={savingId === "new"}
            >
              {savingId === "new" ? "Adding…" : "Add slide"}
            </button>
          </div>
        </div>

        {status ? (
          <div className="mt-4 rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}

        <div className="mt-8 space-y-6">
          {sorted.map((r) => (
            <div key={r.id} className="rounded-2xl border border-black/10 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-black/70">
                  Slide #{r.sort_order}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveSlide(r.id)}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                    disabled={savingId === r.id}
                  >
                    {savingId === r.id ? "Saving…" : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteSlide(r.id)}
                    className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold"
                    disabled={savingId === r.id}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-black/60">
                    Sort order (1, 2, 3…)
                  </label>
                  <input
                    className={inputClass()}
                    type="number"
                    value={r.sort_order}
                    onChange={(e) => updateRow(r.id, { sort_order: Number(e.target.value || 0) })}
                  />
                </div>

                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-black/70">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={(e) => updateRow(r.id, { is_active: e.target.checked })}
                    />
                    Active (show on home page)
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60">Headline</label>
                  <input
                    className={inputClass()}
                    value={r.headline}
                    onChange={(e) => updateRow(r.id, { headline: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60">Title</label>
                  <input
                    className={inputClass()}
                    value={r.title}
                    onChange={(e) => updateRow(r.id, { title: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-black/60">Body</label>
                  <textarea
                    className={inputClass() + " min-h-[110px]"}
                    value={r.body}
                    onChange={(e) => updateRow(r.id, { body: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60">Right label</label>
                  <input
                    className={inputClass()}
                    value={r.right_label}
                    onChange={(e) => updateRow(r.id, { right_label: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60">CTA text</label>
                  <input
                    className={inputClass()}
                    value={r.cta_text}
                    onChange={(e) => updateRow(r.id, { cta_text: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-black/60">CTA link (href)</label>
                  <input
                    className={inputClass()}
                    value={r.cta_href}
                    onChange={(e) => updateRow(r.id, { cta_href: e.target.value })}
                    placeholder="#membership or https://..."
                  />
                </div>

                {/* ✅ Upload image */}
                <div className="md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-black/60">
                        Right image (optional)
                      </div>
                      <div className="mt-1 text-xs text-black/50">
                        This is a real upload (Supabase Storage bucket: <b>news-images</b>)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startUpload(r.id)}
                        className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                        disabled={savingId === r.id}
                      >
                        {savingId === r.id ? "Working…" : "Upload image"}
                      </button>

                      <button
                        type="button"
                        onClick={() => clearImage(r.id)}
                        className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold"
                        disabled={savingId === r.id}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  {r.right_image_url ? (
                    <div className="mt-3 rounded-xl border border-black/10 overflow-hidden">
                      <div className="px-4 py-2 text-xs font-semibold text-black/60 bg-black/5">
                        Preview
                      </div>
                      <div className="relative h-48 bg-black">
                        <img
                          src={r.right_image_url}
                          alt="Preview"
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/25" />
                      </div>
                      <div className="px-4 py-2 text-xs text-black/60">
                        Saved URL: <span className="break-all">{r.right_image_url}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-black/50">
                      No image uploaded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/70">
              No slides found yet. Run Step 19 SQL, then refresh.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
