"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewTrainerPage() {
  const router = useRouter();

  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(""); 
  const [lastName, setLastName] = useState(""); 
  const [title, setTitle] = useState(""); 
  const [bio, setBio] = useState(""); 

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [zoom, setZoom] = useState(1);

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

  async function handleSave() {
    setSaving(true);
    let photoUrl: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const fileName = `trainer-${Date.now()}.${ext}`;
      await supabase.storage.from("trainer-photos").upload(fileName, photoFile, { upsert: true });
      photoUrl = supabase.storage.from("trainer-photos").getPublicUrl(fileName).data.publicUrl;
    }

    await supabase.from("trainers").insert({
      first_name: firstName,
      last_name: lastName,
      title,
      bio,
      photo_url: photoUrl,
    });

    router.push("/admin/trainers");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Add Trainer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-4">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="First name" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Last name" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Title" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full rounded-lg border px-3 py-2" placeholder="Bio" />
          <input type="file" accept="image/*" onChange={handleFile} />
        </div>

        <div>
          <div className="aspect-[4/3] rounded-2xl border border-black/10 overflow-hidden bg-black/5 relative">
            {previewUrl && (
              <div
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                <img
                  src={previewUrl}
                  className="absolute top-1/2 left-1/2 select-none pointer-events-none"
                  style={{
                    minWidth: "100%",
                    minHeight: "100%",
                    transform: `translate(calc(-50% + ${posX}%), calc(-50% + ${posY}%)) scale(${zoom})`,
                  }}
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-full bg-black px-6 py-2 text-sm font-semibold text-white">
          Create Trainer
        </button>
        <button onClick={() => router.push("/admin/trainers")} className="rounded-full border border-black/30 px-6 py-2 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}
