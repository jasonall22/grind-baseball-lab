// src/app/dashboard/admin/workouts/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Exercise = {
  id: string;
  name: string;
  category: string;
};

type TemplateExercise = {
  exercise_id: string;
  prescribed_sets: number | '';
  prescribed_reps: number | '';
  prescribed_weight: number | '';
  notes: string;
};

export default function AdminWorkoutTemplatesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);

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
        .select('id, name, category')
        .order('name');

      if (rows) setExercises(rows);
      setLoading(false);
    }

    init();
  }, [router]);

  function addExercise(exerciseId: string) {
    setItems((prev) => [
      ...prev,
      {
        exercise_id: exerciseId,
        prescribed_sets: '',
        prescribed_reps: '',
        prescribed_weight: '',
        notes: '',
      },
    ]);
  }

  async function saveTemplate() {
    if (!templateName || !templateCategory || items.length === 0) return;

    const { data: template } = await supabase
      .from('workout_templates')
      .insert({
        title: templateName,
        category: templateCategory,
      })
      .select()
      .single();

    if (!template) return;

    const rows = items.map((i, index) => ({
      workout_template_id: template.id,
      exercise_id: i.exercise_id,
      sort_order: index,
      prescribed_sets: i.prescribed_sets || null,
      prescribed_reps: i.prescribed_reps || null,
      prescribed_weight: i.prescribed_weight || null,
      notes: i.notes || null,
    }));

    await supabase.from('workout_template_exercises').insert(rows);

    setTemplateName('');
    setTemplateCategory('');
    setItems([]);
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
      <h1 className="text-xl font-semibold">Workout Templates</h1>

      {/* Template Info */}
      <div className="bg-gray-900 rounded p-4 space-y-3">
        <input
          placeholder="Workout name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />

        <input
          placeholder="Category (Hitting / Throwing / Arm Care / Strength)"
          value={templateCategory}
          onChange={(e) => setTemplateCategory(e.target.value)}
          className="w-full bg-black p-3 rounded text-sm"
        />
      </div>

      {/* Add Exercises */}
      <div className="bg-gray-900 rounded p-4 space-y-3">
        <h2 className="text-sm font-semibold">Add Exercises</h2>

        <div className="flex flex-wrap gap-2">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              className="text-xs border border-gray-700 rounded px-3 py-2"
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {/* Template Exercises */}
      {items.map((item, idx) => {
        const ex = exercises.find((e) => e.id === item.exercise_id);

        return (
          <div
            key={idx}
            className="bg-gray-900 rounded p-4 space-y-2"
          >
            <div className="font-medium">{ex?.name}</div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <input
                placeholder="Sets"
                type="number"
                value={item.prescribed_sets}
                onChange={(e) => {
                  const v = [...items];
                  v[idx].prescribed_sets = Number(e.target.value);
                  setItems(v);
                }}
                className="bg-black p-2 rounded"
              />

              <input
                placeholder="Reps"
                type="number"
                value={item.prescribed_reps}
                onChange={(e) => {
                  const v = [...items];
                  v[idx].prescribed_reps = Number(e.target.value);
                  setItems(v);
                }}
                className="bg-black p-2 rounded"
              />

              <input
                placeholder="Weight"
                type="number"
                value={item.prescribed_weight}
                onChange={(e) => {
                  const v = [...items];
                  v[idx].prescribed_weight = Number(e.target.value);
                  setItems(v);
                }}
                className="bg-black p-2 rounded"
              />
            </div>

            <textarea
              placeholder="Notes (optional)"
              value={item.notes}
              onChange={(e) => {
                const v = [...items];
                v[idx].notes = e.target.value;
                setItems(v);
              }}
              className="w-full bg-black p-2 rounded text-sm"
            />
          </div>
        );
      })}

      {items.length > 0 && (
        <button
          onClick={saveTemplate}
          className="w-full bg-white text-black rounded p-3 text-sm font-medium"
        >
          Save Workout Template
        </button>
      )}
    </div>
  );
}
