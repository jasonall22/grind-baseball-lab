export default function SiteFooter() {
  const mapsQuery = encodeURIComponent(
    "The Grind Baseball Lab, 613 Cypress Ave, Venice, FL 34285"
  );
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const email = "info@grindbaseballlab.com";
  const phoneDisplay = "941-800-2737";
  const phoneHref = "tel:+19418002737";
  const facebookHref =
    "https://www.facebook.com/profile.php?id=61568109854345";

  return (
    <footer className="relative bg-white text-black">
      {/* top divider */}
      <div className="h-px w-full bg-black/10" />

      {/* soft background + subtle pattern */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {/* gentle gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-black/[0.03]" />
          {/* subtle “spotlight” */}
          <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#1FA2FF]/10 blur-3xl" />
          {/* faint dot grid */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.25) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14">
          {/* main footer card */}
          <div className="relative">
            {/* halo behind card */}
            <div className="pointer-events-none absolute -inset-8 opacity-70 blur-3xl">
              <div className="h-full w-full rounded-[48px] bg-gradient-to-br from-[#1FA2FF]/18 via-black/0 to-black/10" />
            </div>

            {/* gradient border wrapper */}
            <div className="relative rounded-3xl bg-gradient-to-br from-black/15 via-black/5 to-[#1FA2FF]/22 p-[1px]">
              <div className="rounded-3xl border border-black/10 bg-white shadow-sm">
                <div className="grid gap-10 px-6 py-10 sm:px-10 lg:grid-cols-3">
                  {/* Brand */}
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-black text-white flex items-center justify-center text-sm font-extrabold">
                        GB
                      </div>
                      <div>
                        <div className="text-base font-semibold tracking-tight">
                          The Grind Baseball Lab
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tracking-[0.18em] text-black/45 uppercase">
                          Train like it matters
                        </div>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-relaxed text-black/65">
                      Indoor baseball training. Cages, HitTrax, lessons, clinics,
                      and camps.
                    </p>

                    {/* accent */}
                    <div className="mt-6 h-[3px] w-16 rounded-full bg-[#1FA2FF]" />
                  </div>

                  {/* Location */}
                  <div>
                    <div className="text-sm font-semibold">Location</div>

                    <div className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                      <div className="text-sm font-semibold text-black">
                        613 Cypress Ave
                      </div>
                      <div className="mt-1 text-sm text-black/65">
                        Venice, FL 34285
                      </div>

                      <div className="mt-4">
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-black shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0284C7] hover:border-[#0284C7] hover:text-white hover:shadow-md"
                        >
                          <span>Get Directions</span>
                          <span className="transition-transform duration-200 group-hover:translate-x-[2px]">
                            →
                          </span>
                        </a>
                      </div>

                      <div className="mt-4 text-xs text-black/50">
                        Easy parking • Quick check-in
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <div className="text-sm font-semibold">Contact</div>

                    <div className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                      <div className="space-y-2 text-sm text-black/70">
                        <div>
                          <span className="font-semibold text-black">Email:</span>{" "}
                          <a
                            href={`mailto:${email}`}
                            className="underline underline-offset-4 hover:text-[#0284C7]"
                          >
                            {email}
                          </a>
                        </div>

                        <div>
                          <span className="font-semibold text-black">Phone:</span>{" "}
                          <a
                            href={phoneHref}
                            className="underline underline-offset-4 hover:text-[#0284C7]"
                          >
                            {phoneDisplay}
                          </a>
                        </div>

                        <div>
                          <span className="font-semibold text-black">Facebook:</span>{" "}
                          <a
                            href={facebookHref}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4 hover:text-[#0284C7]"
                          >
                            Visit our page
                          </a>
                        </div>
                      </div>

                      {/* ICON BUTTONS (no external deps) */}
                      <div className="mt-5 flex items-center gap-3">
                        <IconButton
                          href={`mailto:${email}`}
                          label="Email"
                          title="Email"
                          icon={<MailIcon />}
                        />
                        <IconButton
                          href={phoneHref}
                          label="Call"
                          title="Call"
                          icon={<PhoneIcon />}
                        />
                        <IconButton
                          href={facebookHref}
                          label="Facebook"
                          title="Facebook"
                          newTab
                          icon={<FacebookIcon />}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* bottom bar */}
                <div className="border-t border-black/10 px-6 py-6 sm:px-10">
                  <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                    <div className="text-xs text-black/50">
                      © {new Date().getFullYear()} The Grind Baseball Lab. All
                      rights reserved.
                    </div>

                    <div className="text-xs text-black/50">
                      Built for training • Powered by Swift bookings
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* tiny divider below */}
            <div className="mt-12 h-px w-full bg-black/10" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function IconButton({
  href,
  label,
  title,
  icon,
  newTab,
}: {
  href: string;
  label: string;
  title: string;
  icon: React.ReactNode;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={title}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-black/[0.02] text-black/70 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0284C7] hover:border-[#0284C7] hover:text-white hover:shadow-md"
    >
      {icon}
    </a>
  );
}

function MailIcon() {
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
      <path d="M4 4h16v16H4z" opacity="0" />
      <path d="M4 8l8 5 8-5" />
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

function PhoneIcon() {
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.09 2h3a2 2 0 0 1 2 1.72c.12.9.3 1.77.54 2.61a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.47-1.09a2 2 0 0 1 2.11-.45c.84.24 1.71.42 2.61.54A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function FacebookIcon() {
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
      {/* Simple Facebook "f" mark */}
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
