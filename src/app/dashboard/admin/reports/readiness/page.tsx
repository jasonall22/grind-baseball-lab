// src/app/dashboard/admin/reports/readiness/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  id: string;
  log_date: string;
  soreness: number;
  fatigue: number;
  notes: string | null;
  profiles: {
    full_name: string | null;
  };
};

export default function AdminReadinessNotesPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // Auth
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      // Role check
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileData?.role !== 'admin') {
        router.replace('/');
        return;
      }

      // Readiness logs (Supabase returns profiles as ARRAY)
      const { data: rawRows } = await supabase
        .from('athlete_readiness_logs')
        .select(`
          id,
          log_date,
          soreness,
          fatigue,
          notes,
          profiles (
            full_name
          )
        `)
        .order('log_date', { ascending: false })
        .limit(50);

      // ✅ NORMALIZE SHAPE
      const normalized: Row[] =
        rawRows?.map((r: any) => ({
          id: r.id,
          log_date: r.log_date,
          soreness: r.soreness,
          fatigue: r.fatigue,
          notes: r.notes,
          profiles: r.profiles[0], // 👈 array → object
        })) ?? [];

      setRows(normalized);
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
    <div className="min-h-screen bg-black text-white p-4 space-y-4">
      <h1 className="text-xl font-semibold">Athlete Readiness Notes</h1>

      {rows.map((r) => (
        <div key={r.id} className="bg-gray-900 rounded p-4">
          <div className="text-sm font-medium">
            {r.profiles.full_name ?? 'Athlete'}
          </div>
          <div className="text-xs text-gray-400">
            {r.log_date} • Soreness {r.soreness} • Fatigue {r.fatigue}
          </div>
          {r.notes && (
            <div className="text-sm mt-2 text-gray-300">
              {r.notes}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
