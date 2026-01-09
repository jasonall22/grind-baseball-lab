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

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  const items: NavItem[] = useMemo(
    () => [
      { label: "HOME", href: "/" },
      // ✅ Change: BOOK NOW should jump to Pricing section
      { label: "BOOK NOW", href: "#pricing" },
      { label: "OUR PLACE", href: "#our-place" },
      { label: "TRAINERS", href: "#trainers" },
      // ✅ Change: CAGE RENTAL -> CONTACT US (goes to the new /contact page)
      { label: "CONTACT US", href: "/contact" },
    ],
    []
  );

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);

  const isLoginPage = pathname === "/login" || pathname === "/signup";
  const isLoggedIn = !!userEmail;

  const welcomeName = pickDisplayName({
    profile,
    meta: userMeta,
    email: userEmail,
  });
  const isAdmin = (profile?.role ?? "") === "admin";

  useEffect(() => {
    let alive = true;

    async function loadProfile(userId: string) {
      // Pull the name from profiles table
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

      // Pull name fallback from Auth metadata too
      const meta = (session?.user?.user_metadata ?? null) as UserMeta | null;
      setUserMeta(meta);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const email = session?.user?.email ?? null;
      setUserEmail(email);

      const meta = (session?.user?.user_metadata ?? null) as UserMeta | null;
      setUserMeta(meta);

      if (session?.user?.id) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setMenuOpen(false);
      }
    });

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
      if (e.key === "Escape") setMenuOpen(false);
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
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Logo centered */}
        <div className="flex items-center justify-center">
          <Link href="/" aria-label="The Grind Baseball Lab home" className="block">
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

        {/* Links centered + pill on the right */}
        <div className="relative mt-5 flex items-center">
          {/* Center links */}
          <nav className="mx-auto flex flex-wrap items-center justify-center gap-6">
            {items.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname === item.href;

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

          {/* Right pill */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2" ref={pillRef}>
            {!isLoggedIn ? (
              <Link
                href="/login"
                aria-current={isLoginPage ? "page" : undefined}
                className={
                  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-[0.28em] text-white/90 normal-case" +
                  (isLoginPage ? " pointer-events-none opacity-60" : "")
                }
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
                  <span className="whitespace-nowrap">Welcome {welcomeName}</span>
                  <span className="text-white/70">▼</span>
                </button>

                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                  >
                    <div className="py-2">
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-3 text-sm text-white/90 hover:bg-white/5"
                      >
                        Profile
                      </Link>

                      {isAdmin ? (
                        <Link
                          href="/admin"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-3 text-sm text-white/90 hover:bg-white/5"
                        >
                          Admin Dashboard
                        </Link>
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
