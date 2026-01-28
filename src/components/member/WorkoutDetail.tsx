'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ExerciseRow = {
  id: string;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_weight: number | null;
  notes: string | null;
  exercises: {
    id: string;
    name: string;
  };
};

type WorkoutTemplate = {
  title: string;
  workout_template_exercises: ExerciseRow[];
};

type ExerciseLogDraft = {
  completed: boolean;
  sets?: number;
  reps?: number;
  weight?: number;
};

type Props = {
  workoutAssignmentId: string;
  onBack: () => void;
};

export default function WorkoutDetail({ workoutAssignmentId, onBack }: Props) {
  const [title, setTitle] = useState('Workout');
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, ExerciseLogDraft>>({});
  const [loading, setLoading] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(true);

  async function ensureSession() {
    const { data: existing } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('workout_assignment_id', workoutAssignmentId)
      .single();

    if (existing?.id) {
      setSessionId(existing.id);
      return existing.id;
    }

    const { data: created } = await supabase
      .from('workout_sessions')
      .insert({
        workout_assignment_id: workoutAssignmentId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (created?.id) {
      setSessionId(created.id);
      return created.id;
    }

    return null;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

      const session = await ensureSession();

      const { data } = await supabase
        .from('workout_assignments')
        .select(`
          workout_templates (
            title,
            workout_template_exercises (
              id,
              prescribed_sets,
              prescribed_reps,
              prescribed_weight,
              notes,
              exercises (
                id,
                name
              )
            )
          )
        `)
        .eq('id', workoutAssignmentId)
        .single();

      if (data?.workout_templates?.length) {
        const tpl = data.workout_templates[0] as WorkoutTemplate;
        setTitle(tpl.title);
        setExercises(tpl.workout_template_exercises);
      }

      if (session) {
        const { data: existingLogs } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('workout_session_id', session);

        if (existingLogs) {
          const mapped: Record<string, ExerciseLogDraft> = {};
          existingLogs.forEach((l) => {
            mapped[l.exercise_id] = {
              completed: l.completed,
              sets: l.sets ?? undefined,
              reps: l.reps ?? undefined,
              weight: l.weight ?? undefined,
            };
          });
          setLogs(mapped);
        }
      }

      setLoading(false);
    }

    load();
  }, [workoutAssignmentId]);

  async function saveLog(exerciseId: string, draft: ExerciseLogDraft) {
    if (!sessionId) return;

    setLogs((prev) => ({
      ...prev,
      [exerciseId]: draft,
    }));

    await supabase.from('exercise_logs').upsert({
      workout_session_id: sessionId,
      exercise_id: exerciseId,
      completed: draft.completed,
      sets: draft.sets ?? null,
      reps: draft.reps ?? null,
      weight: draft.weight ?? null,
      logged_at: new Date().toISOString(),
    });
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Loading workout…</div>;
  }

  return (
    <div className="relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-2 py-3">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 mb-1"
        >
          ← Back to Week
        </button>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>

          <button
            onClick={() => setHideCompleted((v) => !v)}
            className="text-xs text-gray-400 border border-gray-700 rounded px-2 py-1"
          >
            {hideCompleted ? 'Show Completed' : 'Hide Completed'}
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        {exercises.map((e) => {
          const draft = logs[e.exercises.id] ?? { completed: false };

          if (hideCompleted && draft.completed) {
            return null;
          }

          return (
            <div
              key={e.id}
              className={`rounded p-4 ${
                draft.completed
                  ? 'bg-gray-800 opacity-60'
                  : 'bg-gray-900'
              }`}
            >
              <div className="font-medium text-base">
                {e.exercises.name}
              </div>

              <label className="flex items-center gap-3 mt-3 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={draft.completed}
                  onChange={(ev) =>
                    saveLog(e.exercises.id, {
                      ...draft,
                      completed: ev.target.checked,
                    })
                  }
                />
                Completed
              </label>

              {!draft.completed && (
                <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                  <input
                    placeholder="Sets"
                    type="number"
                    value={draft.sets ?? ''}
                    onChange={(ev) =>
                      saveLog(e.exercises.id, {
                        ...draft,
                        sets: Number(ev.target.value),
                      })
                    }
                    className="bg-black p-3 rounded"
                  />

                  <input
                    placeholder="Reps"
                    type="number"
                    value={draft.reps ?? ''}
                    onChange={(ev) =>
                      saveLog(e.exercises.id, {
                        ...draft,
                        reps: Number(ev.target.value),
                      })
                    }
                    className="bg-black p-3 rounded"
                  />

                  <input
                    placeholder="Weight"
                    type="number"
                    value={draft.weight ?? ''}
                    onChange={(ev) =>
                      saveLog(e.exercises.id, {
                        ...draft,
                        weight: Number(ev.target.value),
                      })
                    }
                    className="bg-black p-3 rounded"
                  />
                </div>
              )}

              {e.notes && (
                <div className="text-xs text-gray-500 mt-3">
                  {e.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
