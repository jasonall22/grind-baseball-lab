"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Trainer = {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  bio: string | null;
  photo_url: string | null;
  photo_position: string | null;
  photo_scale: number | null;
  sort_order: number;
  is_active: boolean;
};

function BioModal({
  open,
  onClose,
  trainer,
}: {
  open: boolean;
  onClose: () => void;
  trainer: Trainer | null;
}) {
  if (!open || !trainer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {trainer.first_name} {trainer.last_name}
            </h2>
            {trainer.title && (
              <div className="mt-2 inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs font-semibold text-black/70">
                {trainer.title}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-black/20 px-3 py-1.5 text-sm font-semibold hover:bg-[#0284C7] hover:border-[#0284C7] hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-4 text-sm leading-relaxed text-black/80 whitespace-pre-wrap">
          {trainer.bio}
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-black/10 bg-white shadow-sm overflow-hidden">
      <div className="aspect-[4/3] bg-black/[0.04]" />
      <div className="p-6 text-center">
        <div className="mx-auto h-5 w-40 rounded bg-black/10" />
        <div className="mx-auto mt-3 h-4 w-28 rounded bg-black/10" />
        <div className="mx-auto mt-4 h-4 w-56 rounded bg-black/10" />
        <div className="mx-auto mt-2 h-4 w-52 rounded bg-black/10" />
        <div className="mx-auto mt-6 h-10 w-28 rounded-full bg-black/10" />
      </div>
    </div>
  );
}

export default function TrainersSection() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [openTrainer, setOpenTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from("trainers")
        .select(
          "id, first_name, last_name, title, bio, photo_url, photo_position, photo_scale, sort_order, is_active"
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!alive) return;
      setTrainers((data as Trainer[]) ?? []);
      setLoading(false);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="trainers" className="bg-white text-black">
      <BioModal
        open={!!openTrainer}
        trainer={openTrainer}
        onClose={() => setOpenTrainer(null)}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16">
        {/* subtle section halo */}
        <div className="pointer-events-none absolute -inset-10 opacity-60 blur-3xl">
          <div className="h-full w-full rounded-[48px] bg-gradient-to-br from-[#1FA2FF]/15 via-black/0 to-black/10" />
        </div>

        <div className="relative">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              OUR TRAINERS
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-black/60">
              Learn from coaches who care about real improvement—confidence,
              mechanics, and results.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : trainers.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border border-black/10 bg-black/[0.02] p-10 text-center">
                <div className="text-lg font-semibold">No trainers yet.</div>
                <div className="mt-2 text-sm text-black/60">
                  Add trainers in the Admin dashboard and they will appear here.
                </div>
              </div>
            ) : (
              trainers.map((trainer) => (
                <div key={trainer.id} className="group relative">
                  {/* subtle glow behind each card */}
                  <div className="pointer-events-none absolute -inset-4 opacity-0 blur-2xl transition-opacity duration-200 group-hover:opacity-100">
                    <div className="h-full w-full rounded-3xl bg-gradient-to-br from-[#1FA2FF]/20 via-black/5 to-black/10" />
                  </div>

                  {/* gradient border wrapper */}
                  <div className="relative rounded-3xl bg-gradient-to-br from-black/15 via-black/5 to-[#1FA2FF]/20 p-[1px] transition-all duration-200 group-hover:-translate-y-[2px] group-hover:shadow-md">
                    <div className="rounded-3xl border border-black/10 overflow-hidden bg-white shadow-sm flex flex-col">
                      <div className="relative aspect-[4/3] bg-black/5 overflow-hidden">
                        {/* top accent */}
                        <div className="pointer-events-none absolute left-0 top-0 h-[3px] w-full bg-transparent transition-colors duration-200 group-hover:bg-[#1FA2FF]" />

                        {trainer.photo_url ? (
                          <img
                            src={trainer.photo_url}
                            alt={`${trainer.first_name} ${trainer.last_name}`}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            style={{
                              objectPosition: trainer.photo_position ?? "50% 50%",
                              transform: `scale(${trainer.photo_scale ?? 1})`,
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-sm font-semibold text-black/40">
                              Trainer photo
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-6 text-center flex flex-col flex-1">
                        <div className="font-bold text-lg">
                          {trainer.first_name} {trainer.last_name}
                        </div>

                        {trainer.title ? (
                          <div className="mt-2 flex justify-center">
                            <div className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.02] px-3 py-1 text-xs font-semibold text-black/70">
                              {trainer.title}
                            </div>
                          </div>
                        ) : null}

                        {trainer.bio ? (
                          <>
                            <p className="mt-3 text-sm leading-relaxed text-black/75 line-clamp-4">
                              {trainer.bio}
                            </p>

                            <button
                              onClick={() => setOpenTrainer(trainer)}
                              className="mt-4 inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-black shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0284C7] hover:border-[#0284C7] hover:text-white hover:shadow-md"
                            >
                              See more
                            </button>
                          </>
                        ) : (
                          <div className="mt-4 text-sm text-black/50">
                            Bio coming soon.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-14 h-px w-full bg-black/10" />
        </div>
      </div>
    </section>
  );
}
