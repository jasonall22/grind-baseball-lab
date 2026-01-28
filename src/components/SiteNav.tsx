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
    const one = n[0]?.toUpperCase() ?? "";
    if (one) return one;
  }

  const e = clean(email);
  if (e) {
    const beforeAt = e.split("@")[0] ?? "";
    const a = (beforeAt[0] ?? "").toUpperCase();
    const b = (beforeAt[1] ?? "").toUpperCase();
    const two = (a + b).trim();
    if (two) return two;
    return a || "U";
  }

  return "U";
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
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

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);

  const isLoginPage = pathname === "/login" || pathname === "/signup";
  const isLoggedIn = !!userEmail;

  const welcomeName = pickDisplayName({
    profile,
    meta: userMeta,
    email: userEmail,
  });

  const isAdmin = (profile?.role ?? "") === "admin";
  const userInitials = initialsFromName(welcomeName, userEmail);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    let alive = true;

    async function loadProfile(userId: string) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, full_name, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

      if (!alive) return;
      setProfile((prof as ProfileRow) ?? null);
    }

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!alive) return;

      const email = session?.user?.email ?? null;
      setUserEmail(email);

      const meta = (session?.user?.user_metadata ?? null) as UserMeta | null;
      setUserMeta(meta);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const email = session?.user?.email ?? null;
        setUserEmail(email);

        const meta = (session?.user?.user_metadata ?? null) as UserMeta | null;
        setUserMeta(meta);

        if (session?.user?.id) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setMenuOpen(false);
          setMobileOpen(false);
        }
      }
    );

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = pillRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  }

  function goTo(href: string) {
    setMobileOpen(false);
    setMenuOpen(false);

    if (href.startsWith("#")) {
      if (pathname !== "/") {
        router.push(`/${href}`);
        return;
      }

      const id = href.slice(1);
      window.setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.location.hash = href;
      }, 0);
      return;
    }

    router.push(href);
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-center">
            <Link
              href="/"
              aria-label="The Grind Baseball Lab home"
              className="block"
              onClick={() => {
                setMobileOpen(false);
                setMenuOpen(false);
              }}
            >
              <img
                src="/logo.png"
                alt="The Grind Baseball Lab"
                className="h-[92px] sm:h-[112px] w-auto select-none"
              />
            </Link>
          </div>

          <div className="relative mt-5 flex items-center">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 p-2 text-white/90 lg:hidden"
            >
              <HamburgerIcon />
            </button>

            <nav className="mx-auto hidden flex-wrap items-center justify-center gap-6 lg:flex">
              {items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href;

                const cls =
                  "uppercase underline-offset-[10px] hover:underline hover:text-white text-[11px] font-semibold tracking-[0.28em] text-white/80 " +
                  (isActive ? "underline text-white" : "");

                return item.href.startsWith("#") ? (
                  <a key={item.href} href={item.href} className={cls}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.href} href={item.href} className={cls}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              ref={pillRef}
            >
              {!isLoggedIn ? (
                <Link
                  href="/login"
                  aria-label="Login"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/95 hover:bg-white/15"
                >
                  <UserIcon />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[12px] font-semibold tracking-[0.14em] text-white/95 hover:bg-white/15"
                >
                  {userInitials}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="relative flex items-center justify-center">
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <img
                  src="/logo.png"
                  alt="The Grind Baseball Lab"
                  className="h-[64px] w-auto select-none"
                />
              </Link>

              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="absolute right-0 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 p-2 text-white/90"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-10">
              <div className="text-xs font-semibold tracking-[0.28em] text-white/55 uppercase">
                Menu
              </div>

              <div className="mt-5 flex flex-col">
                {items.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => goTo(item.href)}
                    className="w-full text-left py-5 text-3xl font-semibold tracking-tight text-white hover:text-white/90 border-b border-white/10"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-10 text-xs text-white/45">
                © {new Date().getFullYear()} The Grind Baseball Lab
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
