"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function EditTrainerPage() {
  const router = useRouter();
  const params = useParams();
  const trainerId = params.id as string;

  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

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

  // Crop-frame model
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("trainers")
          .select("first_name,last_name,title,bio,photo_url")
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

        setPosX(0);
        setPosY(0);
        setZoom(1);

        setLoading(false);
      } catch (err) {
        console.error("Unexpected load error:", err);
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [trainerId]);

  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !last.current) return;

    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;

    setPosX((v) => Math.max(-50, Math.min(50, v + dx * 0.15)));
    setPosY((v) => Math.max(-50, Math.min(50, v + dy * 0.15)));

    last.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    dragging.current = false;
    last.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPosX(0);
    setPosY(0);
    setZoom(1);
  }

  function handleReset() {
    setPosX(0);
    setPosY(0);
    setZoom(1);
  }

  async function handleSave() {
    setSaving(true);
    let finalUrl = photoUrl;

    try {
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const fileName = `${trainerId}-${Date.now()}.${ext}`;

        await supabase.storage
          .from("trainer-photos")
          .upload(fileName, photoFile, { upsert: true });

        finalUrl = supabase.storage
          .from("trainer-photos")
          .getPublicUrl(fileName).data.publicUrl;
      }

      await supabase
        .from("trainers")
        .update({
          first_name: firstName,
          last_name: lastName,
          title,
          bio,
          photo_url: finalUrl,
        })
        .eq("id", trainerId);

      router.push("/admin/trainers");
    } catch (err) {
      console.error("Save error:", err);
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await supabase.from("trainers").delete().eq("id", trainerId);
      router.push("/admin/trainers");
    } catch (err) {
      console.error("Delete error:", err);
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
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full rounded-lg border px-3 py-2" />

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
                {activeImage && (
                  <div
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  >
                    <img
                      src={activeImage}
                      className="absolute top-1/2 left-1/2 select-none pointer-events-none"
                      style={{
                        width: "auto",
                        height: "auto",
                        minWidth: "100%",
                        minHeight: "100%",
                        transform: `translate(calc(-50% + ${posX}%), calc(-50% + ${posY}%)) scale(${zoom})`,
                      }}
                    />
                  </div>
                )}

                {/* Visible crop frame */}
                <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
              </div>

              <div className="p-4 text-center">
                <div className="font-bold">{firstName} {lastName}</div>
                {title && <div className="text-sm text-black/60">{title}</div>}
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
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-full border border-red-500 px-6 py-2 text-sm font-semibold text-red-600"
        >
          Delete
        </button>
      </div>

      {/* DELETE CONFIRM MODAL */}
      {showDeleteConfirm && (
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
      )}
    </div>
  );
}
