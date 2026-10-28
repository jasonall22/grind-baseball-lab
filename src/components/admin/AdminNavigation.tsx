"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const adminLinks = [
  { href: "/admin/hero", title: "Hero Slider", description: "Edit homepage images, headlines, and buttons." },
  { href: "/admin/news", title: "News & Updates", description: "Manage news slides and announcements." },
  { href: "/admin/trainers", title: "Coaches / Trainers", description: "Manage coach profiles, photos, and display order." },
  { href: "/admin/pricing", title: "Book Cage Time", description: "Edit cage prices and links to Swift booking." },
  { href: "/admin/settings", title: "Website Settings", description: "Update public contact information and website details." },
  { href: "/admin/memberships", title: "Memberships", description: "Edit the membership offers displayed on the website." },
];

export default function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    const result = await supabase.auth.signOut();
    if (result.error) { setError(result.error.message); return; }
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="border-b border-black/10 bg-black px-5 py-5 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin" className="text-lg font-bold">The Grind Baseball Lab · Admin</Link>
          <div className="flex gap-5 text-sm"><Link href="/">View website</Link><button onClick={logout}>Sign out</button></div>
        </div>
        <nav aria-label="Website administration" className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <Link href="/admin" aria-current={pathname === "/admin" ? "page" : undefined}>Dashboard</Link>
          {adminLinks.map((link) => <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined} className={pathname.startsWith(link.href) ? "font-bold underline underline-offset-4" : "text-white/80 hover:text-white"}>{link.title}</Link>)}
        </nav>
        {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
      </div>
    </header>
  );
}
