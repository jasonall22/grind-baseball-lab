import { cache } from "react";
import { DEFAULT_WEBSITE_SETTINGS, type WebsiteSettings } from "@/lib/websiteSettings";

export const getWebsiteSettings = cache(async (): Promise<WebsiteSettings> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_WEBSITE_SETTINGS;

  try {
    const response = await fetch(`${url}/rest/v1/website_settings?select=*&key=eq.default&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_WEBSITE_SETTINGS;
    const rows = await response.json();
    return { ...DEFAULT_WEBSITE_SETTINGS, ...rows[0] };
  } catch {
    return DEFAULT_WEBSITE_SETTINGS;
  }
});
