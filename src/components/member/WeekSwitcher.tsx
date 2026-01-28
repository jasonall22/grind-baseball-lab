'use client';

type Props = {
  weekStart: Date;
  onChange: (d: Date) => void;
};

export default function WeekSwitcher({ weekStart, onChange }: Props) {
  function shift(days: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    onChange(d);
  }

  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => shift(-7)}
        className="px-3 py-2 bg-gray-800 rounded"
      >
        ◀
      </button>

      <div className="text-sm">
        Week of {weekStart.toLocaleDateString()} – {end.toLocaleDateString()}
      </div>

      <button
        onClick={() => shift(7)}
        className="px-3 py-2 bg-gray-800 rounded"
      >
        ▶
      </button>
    </div>
  );
}
