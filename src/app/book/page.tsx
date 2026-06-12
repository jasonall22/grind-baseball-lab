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

  return (
    <section className="bg-white text-black">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Book Online
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-black/60">
              Reserve cage time, lessons, camps, and training through Swift booking.
            </p>
          </div>

          <a
            href={swiftUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-black/10"
          >
            Open in new tab
          </a>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <iframe
            src={swiftUrl}
            title="The Grind Baseball Lab booking"
            className="h-[78vh] min-h-[760px] w-full border-0"
            allow="payment *; clipboard-write"
          />
        </div>
      </div>
    </section>
  );
}
