// src/app/dashboard/admin/workouts/calendar/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  id: string;
  full_name: string | null;
};

type Assignment = {
  id: string;
  member_id: string;
  week_start: string;
  workout_templates: {
    title: string;
  };
};

type Readiness = {
  member_id: string;
  log_date: string;
  soreness: number;
  fatigue: number;
};

export default function AdminWorkoutCalendarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [readiness, setReadiness] = useState<Readiness[]>([]);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return router.replace('/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profile?.role !== 'admin') return router.replace('/');

      const sunday = new Date();
      sunday.setDate(sunday.getDate() - sunday.getDay());
      setWeekStart(sunday);

      const { data: m } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'grind_member')
        .order('full_name');

      setMembers(m ?? []);
      setLoading(false);
    }

    init();
  }, [router]);

  useEffect(() => {
    loadWeekData();
  }, [weekStart]);

  async function loadWeekData() {
    const startISO = weekStart.toISOString().slice(0, 10);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const endISO = end.toISOString().slice(0, 10);

    const [{ data: a }, { data: r }] = await Promise.all([
      supabase
        .from('workout_assignments')
        .select(`
          id,
          member_id,
          week_start,
          workout_templates ( title )
        `)
        .gte('week_start', startISO)
        .lte('week_end', endISO),

      supabase
        .from('athlete_readiness_logs')
        .select('member_id, log_date, soreness, fatigue')
        .gte('log_date', startISO)
        .lte('log_date', endISO),
    ]);

    const normalizedAssignments =
      a?.map((row: any) => ({
        id: row.id,
        member_id: row.member_id,
        week_start: row.week_start,
        workout_templates: row.workout_templates[0],
      })) ?? [];

    setAssignments(normalizedAssignments);
    setReadiness(r ?? []);
  }

  function readinessColor(memberId: string, day: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + day);
    const dateStr = d.toISOString().slice(0, 10);

    const r = readiness.find(
      (x) => x.member_id === memberId && x.log_date === dateStr
    );

    if (!r) return 'border-gray-800';

    if (r.soreness >= 4 || r.fatigue >= 4) return 'border-red-500';
    if (r.soreness === 3 || r.fatigue === 3) return 'border-yellow-400';
    return 'border-green-500';
  }

  function shiftWeek(dir: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={() => shiftWeek(-1)}>◀</button>
        <div className="text-sm font-medium">
          Week of {weekStart.toLocaleDateString()}
        </div>
        <button onClick={() => shiftWeek(1)}>▶</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 border border-gray-800">Member</th>
              {days.map((d) => (
                <th key={d} className="p-2 border border-gray-800">
                  {d}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="p-2 border border-gray-800">
                  {m.full_name ?? 'Member'}
                </td>

                {days.map((_, idx) => {
                  const cellAssignments = assignments.filter(
                    (a) =>
                      a.member_id === m.id &&
                      new Date(a.week_start).getDay() === idx
                  );

                  return (
                    <td
                      key={idx}
                      className={`p-2 border align-top ${readinessColor(
                        m.id,
                        idx
                      )}`}
                    >
                      <div className="space-y-1 min-h-[40px]">
                        {cellAssignments.map((a) => (
                          <div
                            key={a.id}
                            className="bg-gray-800 rounded px-2 py-1 text-xs"
                          >
                            {a.workout_templates.title}
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400">
        🟢 OK • 🟡 Caution • 🔴 Check athlete
      </div>
    </div>
  );
}
