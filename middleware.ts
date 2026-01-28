// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/contact"
  ) {
    return true;
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/logo") ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)
  ) {
    return true;
  }

  if (pathname.startsWith("/api")) return true;

  return false;
}

async function getUserRole(
  supabase: any,
  userId: string
): Promise<"member" | "grind_member" | "admin"> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = (data?.role ?? "member") as string;

  if (role === "admin") return "admin";
  if (role === "grind_member") return "grind_member";
  return "member";
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

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

  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = role === "grind_member" ? "/dashboard" : "/";
      url.search = "";
      url.hash = "";
      return NextResponse.redirect(url);
    }
    return res;
  }

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

  if (role === "member") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
