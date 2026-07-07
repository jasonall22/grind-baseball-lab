import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Online | The Grind Baseball Lab",
  description: "Book cage time, lessons, camps, and training at The Grind Baseball Lab.",
  robots: {
    index: false,
    follow: false,
  },
};

const DEFAULT_SWIFT_URL =
  "https://book.runswiftapp.com/facilities/the-grind-baseball-lab";

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getSafeSwiftUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl || DEFAULT_SWIFT_URL);

    if (url.hostname !== "book.runswiftapp.com") {
      return DEFAULT_SWIFT_URL;
    }

    url.searchParams.set("widgetStyling", "true");
    return url.toString();
  } catch {
    return DEFAULT_SWIFT_URL;
  }
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const swiftUrl = getSafeSwiftUrl(getSearchParamValue(params.url));
  redirect(swiftUrl);
}
