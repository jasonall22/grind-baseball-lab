import { NextResponse } from "next/server";
import { getFacebookNews } from "@/lib/getFacebookNews";

export async function GET() {
  const feed = await getFacebookNews();
  return NextResponse.json({ slides: feed.slides }, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
