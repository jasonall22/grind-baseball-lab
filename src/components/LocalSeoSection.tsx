const serviceCards = [
  {
    title: "Indoor Baseball Cages",
    body: "Reserve cage time for focused swings, team reps, or extra work before a tournament. Our Venice facility gives players a reliable indoor space to train.",
  },
  {
    title: "Hitting Training",
    body: "Work on swing mechanics, approach, timing, and confidence with baseball coaches who understand player development.",
  },
  {
    title: "HitTrax & Lessons",
    body: "Use HitTrax feedback, cage work, and one-on-one coaching to make training measurable and easier to repeat.",
  },
];

const cities = ["Venice", "Englewood", "North Port", "Sarasota"];

export default function LocalSeoSection() {
  return (
    <section className="bg-white text-black" aria-labelledby="local-baseball-training">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0284C7]">
              Venice, Florida baseball training
            </div>
            <h2
              id="local-baseball-training"
              className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Baseball cages, hitting training, and coaching near Venice, FL.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-black/65 sm:text-base">
              The Grind Baseball Lab is an indoor baseball training facility in
              Venice, Florida for athletes looking for batting cage rentals,
              hitting lessons, baseball coaching, camps, and player development.
              We work with players from Venice, Englewood, North Port, Sarasota,
              and surrounding Southwest Florida communities.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {cities.map((city) => (
                <span
                  key={city}
                  className="rounded-full border border-black/10 bg-black/[0.02] px-3 py-1.5 text-xs font-semibold text-black/70"
                >
                  {city}, FL
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {serviceCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
              >
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-black/60">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 h-px w-full bg-black/10" />
      </div>
    </section>
  );
}
