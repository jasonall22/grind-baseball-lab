import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* MEMBERSHIPS */}
        <Link
          href="/admin/memberships"
          className="rounded-2xl border border-black/10 p-5 hover:border-black/30 transition"
        >
          <div className="font-semibold">Memberships</div>
          <div className="mt-1 text-sm text-black/60">
            Manage membership tiers and pricing.
          </div>
        </Link>

        {/* PRICING */}
        <Link
          href="/admin/pricing"
          className="rounded-2xl border border-black/10 p-5 hover:border-black/30 transition"
        >
          <div className="font-semibold">Pricing</div>
          <div className="mt-1 text-sm text-black/60">
            Manage cage rental prices and booking link.
          </div>
        </Link>

        {/* NEWS */}
        <Link
          href="/admin/news"
          className="rounded-2xl border border-black/10 p-5 hover:border-black/30 transition"
        >
          <div className="font-semibold">News & Updates</div>
          <div className="mt-1 text-sm text-black/60">
            Manage homepage news slides.
          </div>
        </Link>

        {/* HERO */}
        <Link
          href="/admin/hero"
          className="rounded-2xl border border-black/10 p-5 hover:border-black/30 transition"
        >
          <div className="font-semibold">Hero Slider</div>
          <div className="mt-1 text-sm text-black/60">
            Control hero images and messaging.
          </div>
        </Link>

        {/* TRAINERS */}
        <Link
          href="/admin/trainers"
          className="rounded-2xl border border-black/10 p-5 hover:border-black/30 transition"
        >
          <div className="font-semibold">Trainers</div>
          <div className="mt-1 text-sm text-black/60">
            Add, edit, reorder, and manage trainers.
          </div>
        </Link>
      </div>
    </div>
  );
}
