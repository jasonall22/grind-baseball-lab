"use client";

import Link from "next/link";
import { adminLinks } from "@/components/admin/AdminNavigation";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold">Website Admin</h1>
      <p className="mt-3 text-black/60">Manage the content shown on The Grind Baseball Lab website.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-2xl border border-black/10 p-6 transition hover:border-sky-600 hover:shadow-sm">
            <h2 className="text-xl font-semibold">{link.title}</h2><p className="mt-3 text-sm leading-6 text-black/60">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
