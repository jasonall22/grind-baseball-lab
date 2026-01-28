"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * ✅ 2D drag that actually feels like "grabbing the photo"
 * We store the crop as:
 * - photo_position: "X% Y%" (object-position)
 * - photo_scale: number (zoom)
 *
 * In the preview we render the image with object-cover + objectPosition,
 * then we let you drag to change objectPosition on BOTH axes.
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

export default function NewTrainerPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Crop controls
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

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!previewUrl) return;

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

    // Convert pixels -> percentage movement.
    // Drag right should move the image right -> objectPosition X increases.
    // Drag down should move the image down -> objectPosition Y increases.
    const deltaXPercent = (dx / st.boxW) * 100;
    const deltaYPercent = (dy / st.boxH) * 100;

    // A little dampening so it feels controllable
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

    // Reset crop to true center
    setPos({ x: 50, y: 50 });
    setZoom(1);
  }

  function handleReset() {
    setPos({ x: 50, y: 50 });
    setZoom(1);
  }

  async function handleSave() {
    setSaving(true);

    try {
      // 1) Insert trainer FIRST, so we have an id (lets us store images in a folder per trainer)
      const { data: created, error: insErr } = await supabase
        .from("trainers")
        .insert({
          first_name: firstName,
          last_name: lastName,
          title,
          bio,
          // Save crop values even if no image yet (safe)
          photo_position: fmtPos(pos.x, pos.y),
          photo_scale: zoom,
        })
        .select("id")
        .single();

      if (insErr || !created?.id) {
        console.error("Insert trainer error:", insErr);
        alert("Could not create trainer. (Are you logged in as admin?)");
        setSaving(false);
        return;
      }

      const trainerId = created.id as string;

      // 2) Upload image if chosen, then store public URL
      let photoUrl: string | null = null;

      if (photoFile) {
        const clean = safeFileName(photoFile.name);
        const ext = clean.includes(".") ? clean.split(".").pop() : "";
        const stamp = Date.now();
        const path = `trainers/${trainerId}/${stamp}-${clean}`;

        const { error: upErr } = await supabase.storage
          .from("trainer-photos")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (upErr) {
          console.error("Upload error:", upErr);
          alert("Trainer created, but image upload failed. (Check bucket + policies.)");
        } else {
          const pub = supabase.storage.from("trainer-photos").getPublicUrl(path);
          photoUrl = pub.data.publicUrl ?? null;

          const { error: uErr } = await supabase
            .from("trainers")
            .update({ photo_url: photoUrl })
            .eq("id", trainerId);

          if (uErr) {
            console.error("Save photo_url error:", uErr);
            alert("Uploaded image, but could not save it to the trainer.");
          }
        }
      }

      router.push("/admin/trainers");
    } catch (err) {
      console.error("Unexpected save error:", err);
      alert("Unexpected error while saving.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Add Trainer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
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
            disabled={!previewUrl}
          >
            Reset Image
          </button>
        </div>

        <div>
          <div className="w-[320px]">
            <div className="relative rounded-2xl border border-black/10 overflow-hidden bg-white shadow-sm">
              <div className="aspect-[4/3] bg-black/5 relative overflow-hidden">
                {previewUrl ? (
                  <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
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
                    Choose an image
                  </div>
                )}

                {/* crop frame */}
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
              </div>

              <div className="p-4 text-center">
                <div className="font-bold">
                  {(firstName || "First") + " " + (lastName || "Last")}
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
                disabled={!previewUrl}
              />
            </div>

            <div className="mt-2 text-[11px] text-black/45">
              Tip: drag the photo any direction to reposition • Reset to center if needed
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create Trainer"}
        </button>

        <button
          onClick={() => router.push("/admin/trainers")}
          className="rounded-full border border-black/30 px-6 py-2 text-sm font-semibold"
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
