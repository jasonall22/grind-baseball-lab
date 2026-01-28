"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * ✅ 2D drag that persists to the DB:
 * - photo_position: "X% Y%" (object-position)
 * - photo_scale: number (zoom)
 */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeFileName(name: string) {
  const trimmed = (name || "").trim();
  const base = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  return base.length ? base : "image";
}

function parsePos(pos: string | null | undefined): { x: number; y: number } {
  const s = (pos ?? "").trim();
  if (!s) return { x: 50, y: 50 };
  const parts = s.split(/\s+/).slice(0, 2);
  const x = Number(String(parts[0] ?? "").replace("%", ""));
  const y = Number(String(parts[1] ?? "").replace("%", ""));
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 100) : 50,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : 50,
  };
}

function fmtPos(x: number, y: number) {
  return `${Math.round(clamp(x, 0, 100))}% ${Math.round(clamp(y, 0, 100))}%`;
}

export default function EditTrainerPage() {
  const router = useRouter();
  const params = useParams();
  const trainerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => parsePos(null));

  // Drag state
  const dragRef = useRef<{
    dragging: boolean;
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
    boxW: number;
    boxH: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("trainers")
        .select("first_name,last_name,title,bio,photo_url,photo_position,photo_scale")
        .eq("id", trainerId)
        .single();

      if (!alive) return;

      if (error || !data) {
        console.error("Trainer load error:", error);
        setLoading(false);
        return;
      }

      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setTitle(data.title ?? "");
      setBio(data.bio ?? "");
      setPhotoUrl(data.photo_url ?? null);

      setPos(parsePos(data.photo_position ?? null));
      setZoom(typeof data.photo_scale === "number" && Number.isFinite(data.photo_scale) ? data.photo_scale : 1);

      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [trainerId]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const activeImage = previewUrl ?? photoUrl;
    if (!activeImage) return;

    const box = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      boxW: Math.max(1, box.width),
      boxH: Math.max(1, box.height),
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const st = dragRef.current;
    if (!st || !st.dragging) return;

    const dx = e.clientX - st.startClientX;
    const dy = e.clientY - st.startClientY;

    const deltaXPercent = (dx / st.boxW) * 100;
    const deltaYPercent = (dy / st.boxH) * 100;

    const damp = 0.85;

    const nextX = clamp(st.startPosX + deltaXPercent * damp, 0, 100);
    const nextY = clamp(st.startPosY + deltaYPercent * damp, 0, 100);

    setPos({ x: nextX, y: nextY });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const st = dragRef.current;
    if (st) st.dragging = false;
    dragRef.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    // Keep their existing crop unless they want Reset.
  }

  function handleReset() {
    setPos({ x: 50, y: 50 });
    setZoom(1);
    setPreviewUrl(null);
    setPhotoFile(null);
  }

  async function handleSave() {
    setSaving(true);
    let finalUrl = photoUrl;

    try {
      // Upload new photo (optional)
      if (photoFile) {
        const clean = safeFileName(photoFile.name);
        const stamp = Date.now();
        const path = `trainers/${trainerId}/${stamp}-${clean}`;

        const { error: upErr } = await supabase.storage
          .from("trainer-photos")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (upErr) {
          console.error("Upload error:", upErr);
          alert("Upload failed. Check bucket + policies.");
          setSaving(false);
          return;
        }

        finalUrl = supabase.storage.from("trainer-photos").getPublicUrl(path).data.publicUrl ?? null;
      }

      const { error: upErr } = await supabase
        .from("trainers")
        .update({
          first_name: firstName,
          last_name: lastName,
          title,
          bio,
          photo_url: finalUrl,
          photo_position: fmtPos(pos.x, pos.y),
          photo_scale: zoom,
        })
        .eq("id", trainerId);

      if (upErr) {
        console.error("Save error:", upErr);
        alert("Could not save trainer. (Are you logged in as admin?)");
        setSaving(false);
        return;
      }

      router.push("/admin/trainers");
    } catch (err) {
      console.error("Save error:", err);
      alert("Unexpected save error.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);

    try {
      const { error } = await supabase.from("trainers").delete().eq("id", trainerId);
      if (error) {
        console.error("Delete error:", error);
        alert("Could not delete trainer.");
        setDeleting(false);
        return;
      }
      router.push("/admin/trainers");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Unexpected delete error.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  const activeImage = previewUrl ?? photoUrl;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Edit Trainer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* FORM */}
        <div className="space-y-4">
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="First name"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Last name"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Title"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Bio"
          />

          <input type="file" accept="image/*" onChange={handleFile} />

          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-black/20 px-4 py-1.5 text-sm font-semibold"
          >
            Reset Image
          </button>
        </div>

        {/* PHOTO VIEWER */}
        <div>
          <div className="w-[320px]">
            <div className="relative rounded-2xl border border-black/10 overflow-hidden bg-white shadow-sm">
              <div className="aspect-[4/3] bg-black/5 relative overflow-hidden">
                {activeImage ? (
                  <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    <img
                      src={activeImage}
                      alt="Trainer"
                      className="h-full w-full select-none pointer-events-none"
                      style={{
                        objectFit: "cover",
                        objectPosition: fmtPos(pos.x, pos.y),
                        transform: `scale(${zoom})`,
                        transformOrigin: "center",
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-black/40">
                    No image yet
                  </div>
                )}

                {/* Visible crop frame */}
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
              </div>

              <div className="p-4 text-center">
                <div className="font-bold">
                  {firstName} {lastName}
                </div>
                {title ? <div className="text-sm text-black/60">{title}</div> : null}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-black/60">Zoom</span>
              <input
                type="range"
                min="1"
                max="2"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>

            <div className="mt-2 text-[11px] text-black/45">
              Tip: drag the photo any direction to reposition • the same crop shows on the Trainers page
            </div>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/admin/trainers")}
          className="rounded-full border border-black/25 px-6 py-2 text-sm font-semibold text-black"
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-full border border-red-500 px-6 py-2 text-sm font-semibold text-red-600"
          disabled={saving}
        >
          Delete
        </button>
      </div>

      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-[90vw] max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Delete Trainer</h2>
            <p className="mt-2 text-sm text-black/70">
              Are you sure you want to permanently delete this trainer? This cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-full border border-black/25 px-4 py-1.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
