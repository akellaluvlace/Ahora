// app/components/BalancePie.tsx
"use client";
import { parseISO } from "date-fns";
import { useMemo } from "react";
import { useDiarySelection } from "./DiarySelectionContext";

type Bullet = string | { text: string };
type Entry = {
  date: string;
  progress?: Bullet[];
  dev?: Bullet[];
  social?: Bullet[];
  personal?: Bullet[];
};

const LABELS = { progress: "Overall", dev: "Dev", social: "Social", personal: "Personal" } as const;

function colorForPct(p: number) {
  if (p >= 20 && p <= 25) return "#10b981"; // Green
  if (p >= 15 && p < 20) return "#f59e0b";  // Orange
  return "#ef4444";                         // Red
}

export default function BalancePie({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;

  const filtered = useMemo(() => {
    if (!cutoff) return entries;
    return entries.filter((e) => parseISO(e.date) <= cutoff);
  }, [entries, cutoff]);

  const count = (k: keyof typeof LABELS) =>
    filtered.reduce((sum, e) => sum + ((e[k] as Bullet[] | undefined)?.length ?? 0), 0);

  const counts = {
    progress: count("progress"),
    dev: count("dev"),
    social: count("social"),
    personal: count("personal"),
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const slices = (Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => {
    const pct = total ? (counts[k] / total) * 100 : 0;
    return { key: k, label: LABELS[k], count: counts[k], pct, hex: colorForPct(pct) };
  });

  let acc = 0;
  const stops = slices.map(s => {
    const start = acc;
    const end = acc + s.pct;
    acc = end;
    return `${s.hex} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  const gradient = total ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#e5e7eb 0% 100%)";

  return (
    <section className="rounded-2xl border p-4 md:p-5 bg-white/60 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Balance Pie</div>
        <div className="text-xs opacity-70">{total} items</div>
      </div>
      <div className="grid grid-cols-2 gap-4 items-center">
        <div className="relative w-40 h-40 mx-auto">
          <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
          <div className="absolute inset-6 rounded-full bg-white dark:bg-neutral-900 border flex flex-col items-center justify-center">
            <div className="text-[10px] opacity-60">Goal: ~25% each</div>
            <div className="text-sm font-semibold">{total} total</div>
          </div>
        </div>
        <ul className="space-y-2">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full border" style={{ backgroundColor: s.hex, borderColor: s.hex }} />
                <span className="text-sm">{s.label}</span>
              </div>
              <div className="text-sm tabular-nums">{s.count} • {total ? `${Math.round(s.pct)}%` : "0%"}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 text-[10px] opacity-60">Green: 20–25% • Orange: 15–19% • Red: &lt;15% or &gt;25%</div>
    </section>
  );
}