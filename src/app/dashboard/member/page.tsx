'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

import WeekSwitcher from '@/components/member/WeekSwitcher';
import WorkoutList from '@/components/member/WorkoutList';
import WorkoutDetail from '@/components/member/WorkoutDetail';
import ProgressSummary from '@/components/member/ProgressSummary';
import ProgressTrends from '@/components/member/ProgressTrends';

type Profile = {
  id: string;
  role: string | null;
};

export default function MemberDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

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
        .select('id, role')
        .eq('id', user.id)
        .single<Profile>();

      if (
        !profile ||
        (profile.role !== 'grind_member' && profile.role !== 'admin')
      ) {
        router.replace('/');
        return;
      }

      // Sunday → Saturday
      const today = new Date();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay());
      setWeekStart(sunday);

      setLoading(false);
    }

    init();
  }, [router]);

  if (loading || !weekStart) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <WeekSwitcher
        weekStart={weekStart}
        onChange={setWeekStart}
      />

      {!selectedWorkoutId ? (
        <>
          <WorkoutList
            weekStart={weekStart}
            onSelectWorkout={setSelectedWorkoutId}
          />

          <ProgressSummary weekStart={weekStart} />
          <ProgressTrends />
        </>
      ) : (
        <WorkoutDetail
          workoutAssignmentId={selectedWorkoutId}
          onBack={() => setSelectedWorkoutId(null)}
        />
      )}
    </div>
  );
}
