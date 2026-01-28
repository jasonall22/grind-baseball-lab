// src/components/member/ProgressTrends.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type TrendRow = {
  exercise_id: string;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  logged_at: string;
};

type Props = {
  limit?: number;
};

export default function ProgressTrends({ limit = 3 }: Props) {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from('exercise_logs')
        .select(`
          exercise_id,
          weight,
          reps,
          logged_at,
          exercises (
            name
          )
        `)
        .not('weight', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(50);

      if (!data) {
        setLoading(false);
        return;
      }

      const map = new Map<string, TrendRow[]>();

      data.forEach((row: any) => {
        const name = row.exercises?.name;
        if (!name) return;

        if (!map.has(row.exercise_id)) {
          map.set(row.exercise_id, []);
        }

        if (map.get(row.exercise_id)!.length < 2) {
          map.get(row.exercise_id)!.push({
            exercise_id: row.exercise_id,
            exercise_name: name,
            weight: row.weight,
            reps: row.reps,
            logged_at: row.logged_at,
          });
        }
      });

      const computed: TrendRow[] = [];

      map.forEach((rows) => {
        if (rows.length === 2) {
          computed.push(rows[0]);
        }
      });

      setTrends(computed.slice(0, limit));
      setLoading(false);
    }

    load();
  }, [limit]);

  if (loading) {
    return (
      <div className="text-xs text-gray-500 mt-6">
        Loading trends…
      </div>
    );
  }

  if (!trends.length) {
    return (
      <div className="text-xs text-gray-500 mt-6">
        No trends yet — log a few workouts to see progress.
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gray-950 border border-gray-800 rounded p-4">
      <h3 className="text-sm font-semibold mb-2">
        Recent Progress
      </h3>

      <div className="space-y-2 text-sm text-gray-300">
        {trends.map((t) => (
          <div key={t.exercise_id} className="flex justify-between">
            <span>{t.exercise_name}</span>
            <span className="text-green-400">
              {t.weight !== null
                ? `${t.weight} ↑`
                : t.reps !== null
                ? `${t.reps} reps`
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
