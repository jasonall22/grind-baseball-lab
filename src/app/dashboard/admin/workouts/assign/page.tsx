// src/app/dashboard/admin/workouts/assign/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type WorkoutTemplate = {
  id: string;
  title: string;
  category: string;
};

export default function AssignWorkoutPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [memberId, setMemberId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [weekStart, setWeekStart] = useState<string>('');

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

      const { data: membersData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'grind_member')
        .order('full_name');

      const { data: templatesData } = await supabase
        .from('workout_templates')
        .select('id, title, category')
        .order('title');

      setMembers(membersData ?? []);
      setTemplates(templatesData ?? []);

      // Default to current week (Sunday)
      const today = new Date();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay());
      setWeekStart(sunday.toISOString().slice(0, 10));

      setLoading(false);
    }

    init();
  }, [router]);

  async function assignWorkout() {
    if (!memberId || !templateId || !weekStart) return;

    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    await supabase.from('workout_assignments').insert({
      member_id: memberId,
      workout_template_id: templateId,
      week_start: start.toISOString().slice(0, 10),
      week_end: end.toISOString().slice(0, 10),
    });

    alert('Workout assigned');
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
      <h1 className="text-xl font-semibold">Assign Workouts</h1>

      <div className="bg-gray-900 rounded p-4 space-y-4">
        {/* Member */}
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        >
          <option value="">Select Member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.email || m.id}
            </option>
          ))}
        </select>

        {/* Template */}
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        >
          <option value="">Select Workout Template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.category})
            </option>
          ))}
        </select>

        {/* Week */}
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />

        <button
          onClick={assignWorkout}
          className="w-full bg-white text-black rounded p-3 text-sm font-medium"
        >
          Assign Workout
        </button>
      </div>
    </div>
  );
}
