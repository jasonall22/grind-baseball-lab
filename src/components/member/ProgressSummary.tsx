'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  weekStart: Date;
};

export default function ProgressSummary({ weekStart }: Props) {
  const [loading, setLoading] = useState(true);
  const [workoutsCompleted, setWorkoutsCompleted] = useState(0);
  const [workoutsTotal, setWorkoutsTotal] = useState(0);
  const [exercisesCompleted, setExercisesCompleted] = useState(0);
  const [exercisesTotal, setExercisesTotal] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // 1️⃣ Get assignments for the week
      const { data: assignments } = await supabase
        .from('workout_assignments')
        .select('id')
        .gte('week_start', weekStart.toISOString().slice(0, 10))
        .lte('week_end', weekEnd.toISOString().slice(0, 10));

      if (!assignments || assignments.length === 0) {
        setLoading(false);
        return;
      }

      setWorkoutsTotal(assignments.length);

      const assignmentIds = assignments.map((a) => a.id);

      // 2️⃣ Get sessions
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, status')
        .in('workout_assignment_id', assignmentIds);

      if (sessions) {
        const completedSessions = sessions.filter(
          (s) => s.status === 'completed'
        );
        setWorkoutsCompleted(completedSessions.length);
      }

      const sessionIds = sessions?.map((s) => s.id) ?? [];

      if (sessionIds.length === 0) {
        setLoading(false);
        return;
      }

      // 3️⃣ Get exercise logs
      const { data: logs } = await supabase
        .from('exercise_logs')
        .select('completed')
        .in('workout_session_id', sessionIds);

      if (logs) {
        setExercisesTotal(logs.length);
        setExercisesCompleted(logs.filter((l) => l.completed).length);
      }

      setLoading(false);
    }

    load();
  }, [weekStart]);

  if (loading) {
    return (
      <div className="text-xs text-gray-500 mt-6">
        Loading progress…
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gray-950 border border-gray-800 rounded p-4">
      <h3 className="text-sm font-semibold mb-2">
        This Week’s Progress
      </h3>

      <div className="text-sm text-gray-300 space-y-1">
        <div>
          Workouts: {workoutsCompleted} / {workoutsTotal} completed
        </div>
        <div>
          Exercises: {exercisesCompleted} / {exercisesTotal} completed
        </div>
      </div>
    </div>
  );
}
