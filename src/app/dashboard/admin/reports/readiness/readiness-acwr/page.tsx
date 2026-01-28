// src/app/dashboard/admin/reports/readiness-acwr/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Member = {
  id: string;
  full_name: string | null;
};

type Session = {
  member_id: string;
  started_at: string;
};

export default function AdminReadinessACWRPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace('/login');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role !== 'admin') return router.replace('/');

      const { data: m } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'grind_member')
        .order('full_name');

      const since = new Date();
      since.setDate(since.getDate() - 28);

      const { data: s } = await supabase
        .from('workout_sessions')
        .select('member_id, started_at')
        .gte('started_at', since.toISOString());

      setMembers(m ?? []);
      setSessions(s ?? []);
      setLoading(false);
    }

    init();
  }, [router]);

  function compute(memberId: string) {
    const now = new Date();

    const memberSessions = sessions.filter(
      (s) => s.member_id === memberId
    );

    const acute = memberSessions.filter((s) => {
      const d = new Date(s.started_at);
      return (now.getTime() - d.getTime()) / 86400000 <= 7;
    }).length;

    const chronic = memberSessions.length / 4; // 28 days / 4 weeks

    const ratio =
      chronic > 0 ? Number((acute / chronic).toFixed(2)) : 0;

    let flag: 'under' | 'ok' | 'risk' = 'ok';

    if (ratio > 1.3) flag = 'risk';
    else if (ratio < 0.8) flag = 'under';

    return { acute, chronic: Number(chronic.toFixed(1)), ratio, flag };
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
      <h1 className="text-xl font-semibold">
        Rolling Load (ACWR-style)
      </h1>

      <div className="space-y-3">
        {members.map((m) => {
          const r = compute(m.id);

          return (
            <div
              key={m.id}
              className="bg-gray-900 rounded p-4 flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {m.full_name ?? 'Member'}
                </div>
                <div className="text-xs text-gray-400">
                  Acute: {r.acute} / Chronic: {r.chronic}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm">
                  Ratio {r.ratio}
                </div>
                <div
                  className={`text-xs ${
                    r.flag === 'ok'
                      ? 'text-green-400'
                      : r.flag === 'under'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {r.flag === 'ok'
                    ? 'Sweet spot'
                    : r.flag === 'under'
                    ? 'Underload'
                    : 'Overload risk'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 mt-4">
        * Acute = last 7 days • Chronic = 4-week average
      </div>
    </div>
  );
}
