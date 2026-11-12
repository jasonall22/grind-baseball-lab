import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liability Waiver | The Grind Baseball Lab",
  description: "Download The Grind Baseball Lab liability waiver to save or print.",
  alternates: { canonical: "/liability" },
};

export default function LiabilityPage() {
  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">The Grind Baseball Lab</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Liability Waiver</h1>
        <p className="mt-6 text-base leading-relaxed text-black/65">
          Download our parent/guardian liability waiver. You can save a copy or print it to complete and sign.
        </p>
        <a
          href="/waivers/the-grind-baseball-lab-waiver-2026.pdf"
          download="The-Grind-Baseball-Lab-Waiver-2026.pdf"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-black px-7 py-3 text-sm font-semibold text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
        >
          Download Liability Waiver (PDF)
        </a>
        <p className="mt-4 text-sm text-black/50">2026 waiver · PDF document</p>
      </div>
    </main>
  );
}
