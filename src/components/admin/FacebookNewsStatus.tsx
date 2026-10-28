"use client";

import { useEffect, useState } from "react";

type FeedStatus = { status: "not_configured" | "connected" | "unavailable"; message: string; postCount: number };

export default function FacebookNewsStatus() {
  const [feed, setFeed] = useState<FeedStatus | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/facebook/status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setFeed).catch(() => { if (!controller.signal.aborted) setError("Could not check the Facebook connection."); });
    return () => controller.abort();
  }, []);

  async function checkConnection() {
    setChecking(true); setError("");
    try {
      const response = await fetch("/api/admin/facebook/status", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setFeed(await response.json());
    } catch { setError("Could not check the Facebook connection."); }
    finally { setChecking(false); }
  }

  return (
    <section aria-labelledby="facebook-news-heading" className="mt-7 rounded-2xl border border-sky-100 bg-sky-50/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="facebook-news-heading" className="text-lg font-semibold">Automatic Facebook updates</h2>
          <p role="status" className="mt-2 max-w-2xl text-sm leading-6 text-black/65">{feed?.message || "Checking connection…"}</p>
          {feed?.status === "connected" && <p className="mt-1 text-sm font-medium text-green-800">Connected · {feed.postCount} recent posts</p>}
        </div>
        <button type="button" disabled={checking} onClick={checkConnection} className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{checking ? "Checking…" : "Check connection"}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {feed?.status !== "connected" && <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold">Connect the Facebook Page</summary>
        <div className="mt-3 space-y-3 leading-6 text-black/70">
          <p>Use a Facebook Page access token for The GRIND Baseball Lab with permission to read the Page’s published posts. Keep this token private.</p>
          <p>In Vercel → this project → Settings → Environment Variables, add <code>FACEBOOK_PAGE_ACCESS_TOKEN</code> as a sensitive Production variable. Set <code>FACEBOOK_PAGE_ID</code> to <code>415532371652979</code>, then redeploy.</p>
          <p>Post on Facebook as usual. The latest six public posts display in your website slider, with photos and links to the original posts. Existing website slides are kept.</p>
          <div className="flex flex-wrap gap-4"><a className="font-semibold text-sky-800 underline" target="_blank" rel="noreferrer" href="https://developers.facebook.com/docs/pages-api/getting-started/">Facebook setup guide</a><a className="font-semibold text-sky-800 underline" target="_blank" rel="noreferrer" href="https://vercel.com/jason-allaires-projects/grind-baseball-lab/settings/environment-variables">Open Vercel settings</a></div>
        </div>
      </details>}
    </section>
  );
}
