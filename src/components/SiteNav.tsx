// src/components/SiteNav.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NavItem = {
  label: string;
  href: string;
};

type ProfileRow = {
  id: string;
  role: "admin" | "member" | "grind_member" | string | null;
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

function pickDisplayName(
  profile: ProfileRow | null,
  meta: UserMeta | null,
  email: string | null
) {
  if (profile?.first_name || profile?.last_name) {
    return [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  }
  if (profile?.full_name) return profile.full_name;
  if (meta?.full_name) return meta.full_name;
  return email ?? "Member";
}

function initialsFromName(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() ?? "U";
}

export default function SiteNav() {
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

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      setUserEmail(session?.user?.email ?? null);
      setUserMeta((session?.user?.user_metadata ?? null) as UserMeta | null);

      if (session?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, role, full_name, first_name, last_name")
          .eq("id", session.user.id)
          .maybeSingle();

        if (mounted) setProfile((prof as ProfileRow) ?? null);
      }

      setAuthReady(true);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      setUserMeta((session?.user?.user_metadata ?? null) as UserMeta | null);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!menuOpen) return;
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  }

  function goTo(href: string) {
    setMobileOpen(false);
    router.push(href.startsWith("#") ? "/" + href : href);
  }

  const isLoggedIn = !!userEmail;
  const displayName = pickDisplayName(profile, userMeta, userEmail);
  const initials = initialsFromName(displayName);

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          {/* Logo */}
          <div className="flex items-center justify-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="The Grind Baseball Lab"
                width={720}
                height={280}
                priority
                className="h-[68px] sm:h-[88px] w-auto"
              />
            </Link>
          </div>

          {/* NAV ROW */}
          <div className="relative h-9 flex items-center justify-center">
            {/* Desktop links */}
            <nav className="hidden gap-6 lg:flex items-center">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[11px] leading-none tracking-[0.28em] text-white/80 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Hamburger (mobile) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="absolute left-0 h-9 w-9 flex items-center justify-center rounded-full bg-white/10 lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>

            {/* Initials */}
            <div
              className="absolute right-0 h-9 w-9 flex items-center justify-center"
              ref={pillRef}
            >
              {!authReady ? null : !isLoggedIn ? (
                <Link
                  href="/login"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10"
                >
                  👤
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-9 w-9 flex items-center justify-center rounded-full bg-white/10 font-semibold text-xs"
                  >
                    {initials}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-3 w-56 rounded-xl bg-black border border-white/10 shadow-lg">
                      <Link
                        href="/dashboard"
                        className="block px-4 py-3 text-sm hover:bg-white/10"
                        onClick={() => setMenuOpen(false)}
                      >
                        Dashboard
                      </Link>

                      {profile?.role === "admin" && (
                        <Link
                          href="/admin"
                          className="block px-4 py-3 text-sm hover:bg-white/10"
                          onClick={() => setMenuOpen(false)}
                        >
                          Admin Dashboard
                        </Link>
                      )}

                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-white/10"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-black text-white">
          <div className="p-6">
            <button onClick={() => setMobileOpen(false)} className="mb-8 text-xl">
              ✕
            </button>

            <nav className="flex flex-col gap-6">
              {items.map((item) => (
                <button
                  key={item.href}
                  onClick={() => goTo(item.href)}
                  className="text-left text-2xl font-semibold"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
