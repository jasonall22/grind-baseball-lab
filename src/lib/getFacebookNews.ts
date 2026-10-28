import { facebookPostsToSlides } from "@/lib/facebookNews";
import type { NewsSlide } from "@/lib/newsTypes";

export type FacebookFeedResult = {
  status: "not_configured" | "connected" | "unavailable";
  slides: NewsSlide[];
  message: string;
};

export async function getFacebookNews(): Promise<FacebookFeedResult> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim() || "415532371652979";
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim() || "v26.0";
  if (!token) return { status: "not_configured", slides: [], message: "Connect your Facebook Page to activate automatic updates." };
  if (!/^\d+$/.test(pageId) || !/^v\d+\.0$/.test(version)) {
    return { status: "unavailable", slides: [], message: "Check the configured Facebook Page ID and API version." };
  }
  try {
    const url = new URL(`https://graph.facebook.com/${version}/${pageId}/published_posts`);
    url.searchParams.set("fields", "id,message,full_picture,permalink_url,created_time,is_published,is_hidden");
    url.searchParams.set("limit", "12");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      // Never expose Facebook's error payload, request headers, or access token.
      console.error("Facebook news request failed", { status: response.status });
      return { status: "unavailable", slides: [], message: "Facebook could not be read. Check the Page token and its read permissions in Vercel." };
    }
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) throw new Error("Invalid response");
    const slides = facebookPostsToSlides(body.data, pageId);
    return { status: "connected", slides, message: slides.length ? "Your latest Facebook posts appear automatically. Updates refresh about once an hour." : "Facebook is connected. Public posts will appear when available." };
  } catch {
    console.error("Facebook news request could not complete");
    return { status: "unavailable", slides: [], message: "Facebook is temporarily unavailable. Existing website news stays visible." };
  }
}
