export type HeroSettingsRow = {
  key: string;
  height_desktop: number;
  height_mobile: number;
  text_align: "left" | "center";
  overlay_color: string;
  overlay_opacity: number;
  text_color: string;
  show_arrows: boolean;
  show_dots: boolean;
  auto_rotate: boolean;
  interval_ms: number;
};

export type HeroSlideRow = {
  id: string;
  sort_order: number;
  is_active: boolean;
  headline: string;
  title: string;
  body: string;
  cta_text: string;
  cta_href: string;
  image_url: string | null;
  overlay_opacity: number | null;
  headline_color?: string | null;
  title_color?: string | null;
  body_color?: string | null;
  cta_text_color?: string | null;
};

export type InitialHeroData = {
  settings: HeroSettingsRow;
  slides: HeroSlideRow[];
};

export const DEFAULT_HERO_SETTINGS: HeroSettingsRow = {
  key: "default",
  height_desktop: 520,
  height_mobile: 440,
  text_align: "center",
  overlay_color: "#000000",
  overlay_opacity: 0.45,
  text_color: "#ffffff",
  show_arrows: true,
  show_dots: true,
  auto_rotate: true,
  interval_ms: 6000,
};
