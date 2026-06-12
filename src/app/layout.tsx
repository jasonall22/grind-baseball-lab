import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.grindbaseballlab.com"),
  title: {
    default:
      "Baseball Cages & Hitting Training in Venice, FL | The Grind Baseball Lab",
    template: "%s | The Grind Baseball Lab",
  },
  description:
    "Indoor baseball cages, hitting training, HitTrax, lessons, camps, and baseball coaching in Venice, FL, serving Englewood, North Port, Sarasota, and nearby players.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "baseball cages Venice FL",
    "batting cages Venice FL",
    "hitting training Venice FL",
    "baseball coach Venice FL",
    "baseball lessons Englewood FL",
    "baseball training North Port FL",
    "baseball cages Sarasota FL",
    "HitTrax Venice FL",
  ],
  openGraph: {
    type: "website",
    url: "https://www.grindbaseballlab.com",
    siteName: "The Grind Baseball Lab",
    title:
      "Baseball Cages & Hitting Training in Venice, FL | The Grind Baseball Lab",
    description:
      "Book indoor batting cages, hitting training, HitTrax, lessons, camps, and baseball coaching near Venice, Englewood, North Port, and Sarasota, FL.",
    images: [
      {
        url: "/logo.png",
        width: 720,
        height: 280,
        alt: "The Grind Baseball Lab logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Baseball Cages & Hitting Training in Venice, FL",
    description:
      "Indoor baseball cages, HitTrax, lessons, camps, and coaching for Venice, Englewood, North Port, and Sarasota players.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <SiteNav />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
