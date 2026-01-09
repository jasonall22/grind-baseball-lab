function TargetIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="22" opacity="0.9" />
      <circle cx="32" cy="32" r="10" opacity="0.9" />
      <path d="M32 6v12" opacity="0.8" />
      <path d="M32 46v12" opacity="0.8" />
      <path d="M6 32h12" opacity="0.8" />
      <path d="M46 32h12" opacity="0.8" />
      <path d="M22 22l20 20" opacity="0.65" />
    </svg>
  );
}

export default function OurTrainingFacilitySection() {
  const items = [
    { label: "New\nEquipment" },
    { label: "Pitching\nMound" },
    { label: "Batting\nCages" },
    { label: "Pitching\nmachines" },
    { label: "Friendly\nEnvironment" },
    { label: "Booking\nApp" },
  ];

  return (
    <section id="our-place" className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-10">
        <h2 className="text-center text-4xl sm:text-5xl font-semibold tracking-tight">
          OUR TRAINING FACILITY
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-center text-sm sm:text-base text-white/75 leading-relaxed">
          The Grind Baseball Lab prides itself on delivering exceptional training experiences designed
          to elevate players at every level. With a focus on comprehensive development, our recent
          projects reflect innovative techniques and methodologies that promote both physical and mental
          growth in athletes.
        </p>

        <div className="mt-10 h-px w-full bg-white/15" />

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-10">
          {items.map((it) => (
            <div key={it.label} className="flex flex-col items-center text-center">
              <div className="text-white/80">
                <TargetIcon />
              </div>
              <div className="mt-3 text-sm text-white/80 leading-tight whitespace-pre-line">
                {it.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
