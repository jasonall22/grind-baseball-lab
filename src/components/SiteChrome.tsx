"use client";

import { usePathname } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import type { WebsiteSettings } from "@/lib/websiteSettings";

export default function SiteChrome({ children, settings }: { children: React.ReactNode; settings: WebsiteSettings }) {
  const pathname = usePathname();
  const isStandaloneRoute = pathname?.startsWith("/admin");

  if (isStandaloneRoute) {
    return <main>{children}</main>;
  }

  return (
    <>
      <SiteNav />
      <main>{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
