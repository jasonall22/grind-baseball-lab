export default function ContactPage() {
  const addressLine1 = "613 Cypress Ave";
  const addressLine2 = "Venice, FL 34285";

  const mapsQuery = encodeURIComponent(
    `The Grind Baseball Lab, ${addressLine1}, ${addressLine2}`
  );
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const email = "info@grindbaseballlab.com";
  const phoneDisplay = "941-800-2737";
  const phoneHref = "tel:+19418002737";
  const facebookHref =
    "https://www.facebook.com/profile.php?id=61568109854345";

  return (
    <main className="bg-white text-black">
      {/* Background wash */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {/* soft gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-black/[0.03]" />
          {/* blue spotlight */}
          <div className="absolute -top-40 left-1/2 h-[720px] w-[720px] -translate-x-1/2 rounded-full bg-[#1FA2FF]/12 blur-3xl" />
          {/* subtle dot grid */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.25) 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16">
          {/* Hero */}
          <div className="text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold tracking-[0.18em] text-black/70 shadow-sm">
              CONTACT THE LAB
              <span className="h-1.5 w-1.5 rounded-full bg-[#1FA2FF]" />
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Let&apos;s get you booked.
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-black/60">
              Cage rentals, HitTrax, lessons, memberships, clinics, camps — reach
              out and we&apos;ll help you pick the right option.
            </p>
          </div>

          {/* Main content card */}
          <div className="relative mt-14">
            {/* halo */}
            <div className="pointer-events-none absolute -inset-8 opacity-60 blur-3xl">
              <div className="h-full w-full rounded-[48px] bg-gradient-to-br from-[#1FA2FF]/18 via-black/0 to-black/10" />
            </div>

            {/* gradient border */}
            <div className="relative rounded-3xl bg-gradient-to-br from-black/15 via-black/5 to-[#1FA2FF]/22 p-[1px]">
              <div className="rounded-3xl border border-black/10 bg-white shadow-sm">
                {/* top accent bar */}
                <div className="h-[4px] w-full bg-gradient-to-r from-[#1FA2FF] via-black/10 to-black/10" />

                <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-3">
                  {/* Location */}
                  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <IconBadge>
                        <PinIcon />
                      </IconBadge>
                      <div className="text-sm font-semibold">Location</div>
                    </div>

                    <div className="mt-5 text-sm font-semibold text-black">
                      {addressLine1}
                    </div>
                    <div className="mt-1 text-sm text-black/65">{addressLine2}</div>

                    <div className="mt-5">
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

                    <div className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-black/60">
                      Tip: Book cage time online from the Pricing section on the
                      homepage.
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <IconBadge>
                        <ChatIcon />
                      </IconBadge>
                      <div className="text-sm font-semibold">Contact</div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <ContactRow
                        label="Email"
                        value={email}
                        href={`mailto:${email}`}
                        icon={<MailIcon />}
                      />
                      <ContactRow
                        label="Phone"
                        value={phoneDisplay}
                        href={phoneHref}
                        icon={<PhoneIcon />}
                      />
                      <ContactRow
                        label="Facebook"
                        value="Message us on Facebook"
                        href={facebookHref}
                        newTab
                        icon={<FacebookIcon />}
                      />
                    </div>

                    <div className="mt-6 flex items-center gap-3">
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

                  {/* Quick answers */}
                  <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <IconBadge>
                        <BoltIcon />
                      </IconBadge>
                      <div className="text-sm font-semibold">Fast answers</div>
                    </div>

                    <p className="mt-5 text-sm leading-relaxed text-black/65">
                      <span className="font-semibold text-black">
                        Cage rentals:
                      </span>{" "}
                      Use Pricing → Book online and pick your time.
                      <br />
                      <br />
                      <span className="font-semibold text-black">Lessons:</span>{" "}
                      Email us your athlete&apos;s age, goals, and availability.
                      <br />
                      <br />
                      <span className="font-semibold text-black">
                        Memberships / Teams:
                      </span>{" "}
                      Send a quick message and we&apos;ll recommend the best plan.
                    </p>

                    <div className="mt-6 h-[3px] w-16 rounded-full bg-[#1FA2FF]" />

                    <div className="mt-6 rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-black/60">
                      We usually reply fastest during business hours.
                    </div>
                  </div>
                </div>

                <div className="border-t border-black/10 px-6 py-6 sm:px-10">
                  <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                    <div className="text-xs text-black/50">
                      The Grind Baseball Lab • Venice, FL
                    </div>
                    <div className="text-xs text-black/50">
                      Built for training • Powered by Swift bookings
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 h-px w-full bg-black/10" />
        </div>
      </div>
    </main>
  );
}

/* ---------- Small UI helpers (no external deps) ---------- */

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.02] text-black/70">
      {children}
    </div>
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
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-black/[0.02] text-black/70 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0284C7] hover:border-[#0284C7] hover:text-white hover:shadow-md"
    >
      {icon}
    </a>
  );
}

function ContactRow({
  label,
  value,
  href,
  icon,
  newTab,
}: {
  label: string;
  value: string;
  href: string;
  icon: React.ReactNode;
  newTab?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.02] text-black/70">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-[0.18em] text-black/45 uppercase">
            {label}
          </div>

          <a
            href={href}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noreferrer" : undefined}
            className="mt-1 block text-sm font-semibold text-black underline underline-offset-4 hover:text-[#0284C7] truncate"
            title={value}
          >
            {value}
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------- Icons (inline SVG) ---------- */

function PinIcon() {
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
      <path d="M12 21s7-4.35 7-11a7 7 0 0 0-14 0c0 6.65 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChatIcon() {
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
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
    </svg>
  );
}

function BoltIcon() {
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
      <path d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z" />
    </svg>
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
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 8l8 5 8-5" />
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
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
