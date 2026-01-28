// src/app/dashboard/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

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

      setLoading(false);
    }

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 space-y-6">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 gap-4">
        <AdminCard
          title="Workout Calendar"
          href="/dashboard/admin/workouts/calendar"
          description="Schedule and move workouts by week"
        />

        <AdminCard
          title="Assign Workouts"
          href="/dashboard/admin/workouts/assign"
          description="Assign templates to members"
        />

        <AdminCard
          title="Workout Templates"
          href="/dashboard/admin/workouts/manage"
          description="Create and edit workout templates"
        />

        <AdminCard
          title="Readiness Overview"
          href="/dashboard/admin/reports/readiness"
          description="Weekly workload & completion"
        />

        <AdminCard
          title="Rolling Load (ACWR)"
          href="/dashboard/admin/reports/readiness-acwr"
          description="Acute vs chronic workload"
        />

        <AdminCard
          title="Athlete Notes"
          href="/dashboard/admin/reports/readiness-notes"
          description="Daily soreness & fatigue check-ins"
        />
      </div>
    </div>
  );
}

function AdminCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-gray-900 rounded p-4 hover:bg-gray-800 transition"
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-gray-400 mt-1">
        {description}
      </div>
    </Link>
  );
}
