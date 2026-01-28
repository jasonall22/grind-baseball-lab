import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ✅ Professional route protection (server-side):
// - Runs before pages load
// - Uses Supabase session cookie
// - Reads role from `profiles.role`
// - Redirects based on your rules
//
// Roles (exact strings):
// - member (default)
// - grind_member
// - admin

function isPublicPath(pathname: string) {
  // Public routes
  if (pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname === "/contact") {
    return true;
  }

  // Next internals + static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons")
  ) {
    return true;
  }

  // API routes: you can keep these open here and protect inside each API route if needed.
  if (pathname.startsWith("/api")) return true;

  return false;
}

async function getUserRole(supabase: any, userId: string): Promise<"member" | "grind_member" | "admin"> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (error) return "member";
  const role = (data?.role ?? "member") as string;

  if (role === "admin") return "admin";
  if (role === "grind_member") return "grind_member";
  return "member";
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // We'll attach any cookie updates to THIS response
  const res = NextResponse.next();

  // Create Supabase server client (reads auth cookies from the request)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Not logged in -> Homepage only
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url);
  }

  const role = await getUserRole(supabase, user.id);

  // Admin routes: admin only
  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      const url = req.nextUrl.clone();

      // grind_member -> dashboard, member -> homepage
      url.pathname = role === "grind_member" ? "/dashboard" : "/";
      url.search = "";
      url.hash = "";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Dashboard routes: grind_member + admin only
  if (pathname.startsWith("/dashboard")) {
    if (role !== "admin" && role !== "grind_member") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      url.hash = "";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Everything else (non-public): your rule says regular members should NOT see anything but homepage
  if (role === "member") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url);
  }

  // grind_member and admin can access other authenticated routes you add later
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
