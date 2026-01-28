// src/components/member/WorkoutList.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type WorkoutAssignment = {
  id: string;
  workout_templates: {
    title: string;
    category: string;
  }[];
};

type Props = {
  weekStart: Date;
  onSelectWorkout: (id: string) => void;
};

export default function WorkoutList({ weekStart, onSelectWorkout }: Props) {
  const [workouts, setWorkouts] = useState<WorkoutAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data, error } = await supabase
        .from('workout_assignments')
        .select(`
          id,
          workout_templates (
            title,
            category
          )
        `)
        .gte('week_start', weekStart.toISOString().slice(0, 10))
        .lte('week_end', weekEnd.toISOString().slice(0, 10))
        .order('created_at', { ascending: true });

      if (!error && data) {
        setWorkouts(data);
      }

      setLoading(false);
    }

    load();
  }, [weekStart]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading workouts…</div>;
  }

  if (!workouts.length) {
    return (
      <div className="text-sm text-gray-400">
        No workouts assigned for this week.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">This Week’s Workouts</h2>

      {workouts.map((w) => {
        const template = w.workout_templates[0];

        return (
          <button
            key={w.id}
            onClick={() => onSelectWorkout(w.id)}
            className="w-full text-left bg-gray-900 rounded p-4"
          >
            <div className="font-medium">{template?.title}</div>
            <div className="text-xs text-gray-400">
              {template?.category}
            </div>
          </button>
        );
      })}
    </div>
  );
}
