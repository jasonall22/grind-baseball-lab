// src/app/dashboard/admin/workouts/manage/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Exercise = {
  id: string;
  name: string;
};

type TemplateExercise = {
  id: string;
  exercise_id: string;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_weight: number | null;
  notes: string | null;
  exercises: Exercise; // normalized
};

type WorkoutTemplate = {
  id: string;
  title: string;
  category: string;
  workout_template_exercises: TemplateExercise[];
};

export default function ManageWorkoutTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.replace('/');
        return;
      }

      const { data: rows } = await supabase
        .from('workout_templates')
        .select(`
          id,
          title,
          category,
          workout_template_exercises (
            id,
            exercise_id,
            prescribed_sets,
            prescribed_reps,
            prescribed_weight,
            notes,
            exercises (
              id,
              name
            )
          )
        `)
        .order('title');

      if (!rows) {
        setLoading(false);
        return;
      }

      // ✅ Normalize Supabase array shapes
      const normalized: WorkoutTemplate[] = rows.map((tpl: any) => ({
        id: tpl.id,
        title: tpl.title,
        category: tpl.category,
        workout_template_exercises: tpl.workout_template_exercises.map(
          (ex: any) => ({
            id: ex.id,
            exercise_id: ex.exercise_id,
            prescribed_sets: ex.prescribed_sets,
            prescribed_reps: ex.prescribed_reps,
            prescribed_weight: ex.prescribed_weight,
            notes: ex.notes,
            exercises: ex.exercises[0], // 👈 array → object
          })
        ),
      }));

      setTemplates(normalized);
      setLoading(false);
    }

    init();
  }, [router]);

  async function saveTemplate(template: WorkoutTemplate) {
    setSavingId(template.id);

    await supabase
      .from('workout_templates')
      .update({
        title: template.title,
        category: template.category,
      })
      .eq('id', template.id);

    for (const ex of template.workout_template_exercises) {
      await supabase
        .from('workout_template_exercises')
        .update({
          prescribed_sets: ex.prescribed_sets,
          prescribed_reps: ex.prescribed_reps,
          prescribed_weight: ex.prescribed_weight,
          notes: ex.notes,
        })
        .eq('id', ex.id);
    }

    setSavingId(null);
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Delete this workout template? This cannot be undone.')) {
      return;
    }

    await supabase
      .from('workout_template_exercises')
      .delete()
      .eq('workout_template_id', templateId);

    await supabase
      .from('workout_templates')
      .delete()
      .eq('id', templateId);

    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-6">
      <h1 className="text-xl font-semibold">Manage Workout Templates</h1>

      {templates.map((tpl) => (
        <div key={tpl.id} className="bg-gray-900 rounded p-4 space-y-4">
          <div className="space-y-2">
            <input
              value={tpl.title}
              onChange={(e) =>
                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === tpl.id ? { ...t, title: e.target.value } : t
                  )
                )
              }
              className="w-full bg-black p-2 rounded text-sm"
            />

            <input
              value={tpl.category}
              onChange={(e) =>
                setTemplates((prev) =>
                  prev.map((t) =>
                    t.id === tpl.id ? { ...t, category: e.target.value } : t
                  )
                )
              }
              className="w-full bg-black p-2 rounded text-sm"
            />
          </div>

          {tpl.workout_template_exercises.map((ex) => (
            <div
              key={ex.id}
              className="border border-gray-800 rounded p-3 space-y-2"
            >
              <div className="text-sm font-medium">
                {ex.exercises.name}
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <input
                  type="number"
                  placeholder="Sets"
                  value={ex.prescribed_sets ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTemplates((prev) =>
                      prev.map((t) =>
                        t.id === tpl.id
                          ? {
                              ...t,
                              workout_template_exercises:
                                t.workout_template_exercises.map((x) =>
                                  x.id === ex.id
                                    ? { ...x, prescribed_sets: v }
                                    : x
                                ),
                            }
                          : t
                      )
                    );
                  }}
                  className="bg-black p-2 rounded"
                />

                <input
                  type="number"
                  placeholder="Reps"
                  value={ex.prescribed_reps ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTemplates((prev) =>
                      prev.map((t) =>
                        t.id === tpl.id
                          ? {
                              ...t,
                              workout_template_exercises:
                                t.workout_template_exercises.map((x) =>
                                  x.id === ex.id
                                    ? { ...x, prescribed_reps: v }
                                    : x
                                ),
                            }
                          : t
                      )
                    );
                  }}
                  className="bg-black p-2 rounded"
                />

                <input
                  type="number"
                  placeholder="Weight"
                  value={ex.prescribed_weight ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTemplates((prev) =>
                      prev.map((t) =>
                        t.id === tpl.id
                          ? {
                              ...t,
                              workout_template_exercises:
                                t.workout_template_exercises.map((x) =>
                                  x.id === ex.id
                                    ? { ...x, prescribed_weight: v }
                                    : x
                                ),
                            }
                          : t
                      )
                    );
                  }}
                  className="bg-black p-2 rounded"
                />
              </div>

              <textarea
                value={ex.notes ?? ''}
                placeholder="Notes"
                onChange={(e) => {
                  const v = e.target.value;
                  setTemplates((prev) =>
                    prev.map((t) =>
                      t.id === tpl.id
                        ? {
                            ...t,
                            workout_template_exercises:
                              t.workout_template_exercises.map((x) =>
                                x.id === ex.id ? { ...x, notes: v } : x
                              ),
                          }
                        : t
                    )
                  );
                }}
                className="w-full bg-black p-2 rounded text-sm"
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={() => saveTemplate(tpl)}
              disabled={savingId === tpl.id}
              className="flex-1 bg-white text-black rounded p-2 text-sm font-medium"
            >
              {savingId === tpl.id ? 'Saving…' : 'Save Changes'}
            </button>

            <button
              onClick={() => deleteTemplate(tpl.id)}
              className="bg-red-600 rounded p-2 text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
