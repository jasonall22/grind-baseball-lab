"use client";

import Image from "next/image";
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
  role: "admin" | "member" | "parent" | "coach" | string | null;
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

  // 1) Profile table (best)
  const pf = clean(p?.first_name);
  const pl = clean(p?.last_name);
  const pFull = clean(p?.full_name);

  if (pf || pl) return [pf, pl].filter(Boolean).join(" ").trim();
  if (pFull) return pFull;

  // 2) Supabase Auth user metadata (good fallback)
  const mf = clean(m?.first_name);
  const ml = clean(m?.last_name);
  const mFull = clean(m?.full_name) || clean(m?.name);
  if (mf || ml) return [mf, ml].filter(Boolean).join(" ").trim();
  if (mFull) return mFull;

  // 3) Last resort
  return email ?? "Member";
}

function getInitials(nameOrEmail: string) {
  const s = (nameOrEmail ?? "").trim();
  if (!s) return "ME";

  // If it's an email, use first letter before @
  if (s.includes("@")) return s[0]?.toUpperCase() ?? "ME";

  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0]?.toUpperCase() ?? "";
  const b = parts[1]?.[0]?.toUpperCase() ?? "";
  const out = (a + b).trim();
  return out || (s[0]?.toUpperCase() ?? "ME");
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

  const [menuOpen, setMenuOpen] = useState(false); // user pill menu (desktop)
  const [mobileOpen, setMobileOpen] = useState(false); // full-screen nav

  const pillRef = useRef<HTMLDivElement | null>(null);

  const isLoginPage = pathname === "/login" || pathname === "/signup";
  const isLoggedIn = !!userEmail;

  const welcomeName = pickDisplayName({
    profile,
    meta: userMeta,
    email: userEmail,
  });
  const initials = getInitials(welcomeName);
  const isAdmin = (profile?.role ?? "") === "admin";

  // Lock body scroll when mobile overlay is open
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

  // Close menus on outside click / escape
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
          {/* Logo centered */}
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
              <Image
                src="/logo.png"
                alt="The Grind Baseball Lab"
                width={720}
                height={280}
                priority
                className="h-[92px] sm:h-[112px] w-auto select-none"
              />
            </Link>
          </div>

          {/* Links centered + right pill + hamburger (mobile/tablet) */}
          <div className="relative mt-5 flex items-center">
            {/* Mobile hamburger (shows below lg) */}
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 p-2 text-white/90 lg:hidden"
            >
              <HamburgerIcon />
            </button>

            {/* Center links (desktop only) */}
            <nav className="mx-auto hidden flex-wrap items-center justify-center gap-6 lg:flex">
              {items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href;

                const base =
                  "uppercase underline-offset-[10px] hover:underline hover:text-white";
                const text =
                  "text-[11px] font-semibold tracking-[0.28em] text-white/80";
                const active = isActive ? "underline text-white" : "";

                const cls = [base, text, active].join(" ").trim();

                if (item.href.startsWith("#")) {
                  return (
                    <a key={item.href} href={item.href} className={cls}>
                      {item.label}
                    </a>
                  );
                }

                return (
                  <Link key={item.href} href={item.href} className={cls}>
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right area */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2"
              ref={pillRef}
            >
              {/* ✅ Mobile/Tablet: circle initials button (below lg) */}
              <div className="lg:hidden">
                {!isLoggedIn ? (
                  <button
                    type="button"
                    aria-label="Login"
                    onClick={() => goTo("/login")}
                    className={
                      "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[12px] font-semibold tracking-[0.10em] text-white/90" +
                      (isLoginPage ? " pointer-events-none opacity-60" : "")
                    }
                    title="Login"
                  >
                    {/* Keep it simple for guests */}
                    IN
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Account menu"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[12px] font-semibold tracking-[0.10em] text-white/95"
                    title={welcomeName}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    {initials}
                  </button>
                )}
              </div>

              {/* Desktop: original pill (lg+) */}
              <div className="hidden lg:block">
                {!isLoggedIn ? (
                  <Link
                    href="/login"
                    aria-current={isLoginPage ? "page" : undefined}
                    className={
                      "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-[0.28em] text-white/90 normal-case" +
                      (isLoginPage ? " pointer-events-none opacity-60" : "")
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </Link>
                ) : (
                  <div className="relative inline-block text-left">
                    <button
                      type="button"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-2 text-[11px] font-semibold tracking-[0.12em] text-white/95"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      <span className="whitespace-nowrap">
                        Welcome {welcomeName}
                      </span>
                      <span className="text-white/70">▼</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Shared dropdown menu (both desktop + mobile circle) */}
              {isLoggedIn && menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                >
                  <div className="py-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => goTo("/dashboard")}
                      className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/5"
                    >
                      Profile
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => goTo("/admin")}
                        className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/5"
                      >
                        Admin Dashboard
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/5"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen mobile/tablet menu */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-6">
            {/* Top row: logo + close */}
            <div className="relative flex items-center justify-center">
              <Link
                href="/"
                aria-label="The Grind Baseball Lab home"
                className="block"
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  src="/logo.png"
                  alt="The Grind Baseball Lab"
                  width={720}
                  height={280}
                  priority
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

              <div className="mt-8">
                {!isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => goTo("/login")}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white/90"
                  >
                    Login
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="text-sm font-semibold text-white/90">
                      Welcome {welcomeName}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => goTo("/dashboard")}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
                      >
                        Profile
                      </button>

                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => goTo("/admin")}
                          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
                        >
                          Admin
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={logout}
                        className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-10 text-xs text-white/45">
                  © {new Date().getFullYear()} The Grind Baseball Lab
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
