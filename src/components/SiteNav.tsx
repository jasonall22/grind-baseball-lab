// src/components/SiteNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = {
  label: string;
  href: string;
};

type ProfileRow = {
  id: string;
  role: "admin" | "member" | "grind_member" | "parent" | "coach" | string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type UserMeta = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
};

function clean(v: string | null | undefined) {
  return (v ?? "").trim();
}

function pickDisplayName(args: {
  profile: ProfileRow | null;
  meta: UserMeta | null;
  email: string | null;
}) {
  const p = args.profile;
  const m = args.meta;
  const email = args.email;

  const pf = clean(p?.first_name);
  const pl = clean(p?.last_name);
  const pFull = clean(p?.full_name);

  if (pf || pl) return [pf, pl].filter(Boolean).join(" ").trim();
  if (pFull) return pFull;

  const mf = clean(m?.first_name);
  const ml = clean(m?.last_name);
  const mFull = clean(m?.full_name) || clean(m?.name);
  if (mf || ml) return [mf, ml].filter(Boolean).join(" ").trim();
  if (mFull) return mFull;

  return email ?? "Member";
}

function initialsFromName(name: string, email: string | null) {
  const n = clean(name);

  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    const two = (first + last).toUpperCase();
    if (two.trim()) return two;
    return n[0]?.toUpperCase() ?? "U";
  }

  if (email) return email[0]?.toUpperCase() ?? "U";
  return "U";
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  const items: NavItem[] = useMemo(
    () => [
      { label: "HOME", href: "/" },
      { label: "BOOK NOW", href: "#pricing" },
      { label: "OUR PLACE", href: "#our-place" },
      { label: "TRAINERS", href: "#trainers" },
      { label: "CONTACT US", href: "/contact" },
    ],
    []
  );

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);

  const isLoggedIn = !!userEmail;

  const welcomeName = pickDisplayName({
    profile,
    meta: userMeta,
    email: userEmail,
  });

  const userInitials = initialsFromName(welcomeName, userEmail);

  useEffect(() => {
    let alive = true;

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (alive) setProfile((data as ProfileRow) ?? null);
    }

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!alive) return;

      setUserEmail(session?.user?.email ?? null);
      setUserMeta((session?.user?.user_metadata ?? null) as UserMeta | null);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }

      setAuthReady(true);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserMeta((session?.user?.user_metadata ?? null) as UserMeta | null);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setMenuOpen(false);
      }

      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-center">
            <Link href="/" className="block">
              <img src="/logo.png" alt="The Grind Baseball Lab" className="h-[92px] sm:h-[112px] w-auto" />
            </Link>
          </div>

          <div className="relative mt-5 flex items-center">
            <button
              onClick={() => setMobileOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/10 p-2 lg:hidden"
            >
              <HamburgerIcon />
            </button>

            <nav className="mx-auto hidden gap-6 lg:flex">
              {items.map((i) => (
                <Link key={i.href} href={i.href} className="text-[11px] tracking-[0.28em] text-white/80">
                  {i.label}
                </Link>
              ))}
            </nav>

            <div className="absolute right-0" ref={pillRef}>
              {!authReady ? null : !isLoggedIn ? (
                <Link href="/login" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <UserIcon />
                </Link>
              ) : (
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold"
                >
                  {userInitials}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black text-white">
          <button onClick={() => setMobileOpen(false)} className="absolute right-4 top-4">
            <CloseIcon />
          </button>
        </div>
      )}
    </>
  );
}
