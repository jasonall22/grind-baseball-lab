export type NewsSlide = {
  id?: string;
  headline: string;
  title: string;
  body: string;
  right_label: string;
  right_image_url: string | null;
  cta_text: string;
  cta_href: string;
  published_at?: string;
  source?: "facebook";
};
