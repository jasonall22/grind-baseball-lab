"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_WEBSITE_SETTINGS, type WebsiteSettings } from "@/lib/websiteSettings";

const fields = [
  { key: "site_name", label: "Website name", type: "text" },
  { key: "email", label: "Contact email", type: "email" },
  { key: "phone", label: "Public phone number", type: "tel" },
  { key: "address_line1", label: "Street address", type: "text" },
  { key: "address_line2", label: "City, state, and ZIP", type: "text" },
  { key: "facebook_url", label: "Facebook URL", type: "url" },
] as const;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.from("website_settings").select("*").eq("key", "default").single().then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(error.message);
      else setSettings({ ...DEFAULT_WEBSITE_SETTINGS, ...data });
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    if (!/^\+?[0-9() .-]{10,25}$/.test(settings.phone) || !/^https?:\/\//i.test(settings.facebook_url)) {
      setError("Enter a valid phone number and an http or https Facebook URL.");
      setSaving(false);
      return;
    }
    const payload = Object.fromEntries(Object.entries(settings).filter(([key]) => key in DEFAULT_WEBSITE_SETTINGS).map(([key, value]) => [key, value.trim()]));
    const { data, error } = await supabase.from("website_settings").upsert(payload, { onConflict: "key" }).select("key").single();
    if (error || !data) setError(error?.message || "Settings could not be saved.");
    else setSaved(true);
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold">Website Settings</h1>
      <p className="mt-3 text-sm text-black/60">Public contact details used by the footer, contact page, and search metadata.</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-green-800">Website settings saved.</p>}
      {loading ? <p className="mt-8">Loading settings…</p> : (
        <form onSubmit={save} className="mt-8 space-y-5">
          {fields.map(({ key, label, type }) => (
            <div key={key}><label htmlFor={key} className="block text-sm font-semibold">{label}</label>
              <input id={key} type={type} required maxLength={500} value={settings[key]} onChange={(event) => { setSettings((current) => ({ ...current, [key]: event.target.value })); setSaved(false); }} className="mt-2 w-full rounded-xl border border-black/20 px-4 py-3" />
            </div>
          ))}
          <button disabled={saving} className="rounded-full bg-black px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save website settings"}</button>
        </form>
      )}
    </div>
  );
}
