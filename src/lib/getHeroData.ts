import {
  DEFAULT_HERO_SETTINGS,
  type HeroSettingsRow,
  type HeroSlideRow,
  type InitialHeroData,
} from "@/lib/heroTypes";

const HERO_REVALIDATE_SECONDS = 60;

async function fetchSupabaseRows<T>(query: string): Promise<T[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return [];

  const baseUrl = supabaseUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${baseUrl}/rest/v1/${query}`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      next: { revalidate: HERO_REVALIDATE_SECONDS },
    });

    if (!res.ok) return [];

    const rows = await res.json();
    return Array.isArray(rows) ? (rows as T[]) : [];
  } catch {
    return [];
  }
}

export async function getInitialHeroData(): Promise<InitialHeroData> {
  const [settingsRows, slideRows] = await Promise.all([
    fetchSupabaseRows<Partial<HeroSettingsRow>>("hero_settings?select=*&key=eq.default&limit=1"),
    fetchSupabaseRows<HeroSlideRow>(
      "hero_slides?select=*&is_active=eq.true&order=sort_order.asc,created_at.asc"
    ),
  ]);

  return {
    settings: {
      ...DEFAULT_HERO_SETTINGS,
      ...settingsRows[0],
    },
    slides: slideRows,
  };
}
