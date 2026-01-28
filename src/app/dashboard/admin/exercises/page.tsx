// src/app/dashboard/admin/exercises/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Exercise = {
  id: string;
  name: string;
  category: string;
  description: string | null;
};

export default function AdminExercisesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

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

      const { data: rows } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (rows) setExercises(rows);
      setLoading(false);
    }

    init();
  }, [router]);

  async function addExercise() {
    if (!name || !category) return;

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name,
        category,
        description: description || null,
      })
      .select()
      .single();

    if (!error && data) {
      setExercises((prev) => [...prev, data]);
      setName('');
      setCategory('');
      setDescription('');
    }
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
      <h1 className="text-xl font-semibold">Exercise Library</h1>

      {/* Add Exercise */}
      <div className="bg-gray-900 rounded p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add New Exercise</h2>

        <input
          placeholder="Exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />

        <input
          placeholder="Category (Hitting, Throwing, Arm Care, Strength)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />

        <button
          onClick={addExercise}
          className="w-full bg-white text-black rounded p-3 text-sm font-medium"
        >
          Add Exercise
        </button>
      </div>

      {/* Exercise List */}
      <div className="space-y-2">
        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="bg-gray-900 rounded p-3 text-sm"
          >
            <div className="font-medium">{ex.name}</div>
            <div className="text-xs text-gray-400">{ex.category}</div>
            {ex.description && (
              <div className="text-xs text-gray-500 mt-1">
                {ex.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
