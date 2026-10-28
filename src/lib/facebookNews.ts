import type { NewsSlide } from "./newsTypes";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function publicUrl(value: unknown, image = false): string | null {
  try {
    const url = new URL(text(value));
    const host = url.hostname.toLowerCase();
    const allowed = image
      ? host.endsWith(".fbcdn.net") || host.endsWith(".fbsbx.com") || host === "facebook.com" || host.endsWith(".facebook.com")
      : host === "facebook.com" || host.endsWith(".facebook.com");
    return url.protocol === "https:" && allowed && !url.username && !url.password && !url.searchParams.has("access_token") ? url.toString() : null;
  } catch { return null; }
}

export function facebookPostsToSlides(posts: unknown, pageId: string): NewsSlide[] {
  if (!Array.isArray(posts) || !/^\d+$/.test(pageId)) return [];
  const seen = new Set<string>();
  return posts.flatMap((post): NewsSlide[] => {
    if (!post || typeof post !== "object") return [];
    const id = text(post.id);
    if (!new RegExp(`^${pageId}_\\d+$`).test(id) || seen.has(id) || post.is_published === false || post.is_hidden === true) return [];
    const message = text(post.message);
    const image = publicUrl(post.full_picture, true);
    const permalink = publicUrl(post.permalink_url);
    const timestamp = Date.parse(text(post.created_time));
    if ((!message && !image) || !permalink || !Number.isFinite(timestamp)) return [];
    seen.add(id);
    const lines = message.split(/\r?\n/);
    const firstLine = lines[0];
    const useHeadline = !!firstLine && firstLine.length <= 110;
    return [{
      id: `facebook-${id}`,
      headline: "FROM OUR FACEBOOK PAGE",
      title: useHeadline ? firstLine : "Latest from The Grind",
      body: useHeadline ? lines.slice(1).join("\n").trim() : message,
      right_label: "THE GRIND BASEBALL LAB",
      right_image_url: image,
      cta_text: "View on Facebook",
      cta_href: permalink,
      published_at: new Date(timestamp).toISOString(),
      source: "facebook",
    }];
  }).sort((a, b) => Date.parse(b.published_at!) - Date.parse(a.published_at!)).slice(0, 6);
}
