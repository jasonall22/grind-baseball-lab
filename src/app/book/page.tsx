import type { Metadata } from "next";

import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Book Online | The Grind Baseball Lab",
  description: "Book cage time, lessons, camps, and training at The Grind Baseball Lab.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BookPage() {
  const fallback = "https://book.runswiftapp.com/facilities/the-grind-baseball-lab";
  let destination = fallback;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const response = await fetch(`${url}/rest/v1/pricing_settings?select=booking_url&key=eq.default&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
      });
      if (response.ok) {
        const rows = await response.json();
        const candidate = new URL(rows[0]?.booking_url || fallback);
        if (["https:", "http:"].includes(candidate.protocol) && !["www.grindbaseballlab.com", "grindbaseballlab.com", "localhost"].includes(candidate.hostname)) destination = candidate.toString();
      }
    } catch {}
  }
  redirect(destination);
}
