// app/components/TimelineControls.tsx
"use client";
import { useMemo, useEffect } from "react";
import { getISOWeek, parseISO, format } from "date-fns";
import { useDiarySelection } from "./DiarySelectionContext";

export default function TimelineControls({ entries }: { entries: { date: string }[] }) {
  const { sel, setSel } = useDiarySelection();
  
  const weeks = useMemo(() => {
    const m = new Map<number, string[]>();
    entries.forEach(e => {
      const w = getISOWeek(parseISO(e.date));
      m.set(w, [...(m.get(w) || []), e.date].sort((a, b) => +new Date(b) - +new Date(a)));
    });
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [entries]);

  const latestWeek = weeks[0]?.[0];
  const latestDay = weeks[0]?.[1][0];

  useEffect(() => {
    if (!sel && latestWeek && latestDay) setSel({ week: latestWeek, day: latestDay });
  }, [sel, latestWeek, latestDay, setSel]);

  if (!weeks.length) return null;
  
  const curWeek = sel?.week ?? latestWeek;
  const daysInWeek = weeks.find(([w]) => w === curWeek)?.[1] || [];
  const dayIndex = Math.max(0, daysInWeek.findIndex(d => d === sel?.day));

  return (
    <div className="rounded-2xl border p-4 md:p-5 bg-white/60 dark:bg-neutral-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Timeline</div>
        <div className="text-xs opacity-70">Default: latest</div>
      </div>
      <div>
        <div className="text-xs mb-1">Week: {curWeek}</div>
        <input type="range" min={weeks[weeks.length-1]?.[0]} max={weeks[0]?.[0]} value={curWeek} onChange={e => setSel({ week: parseInt(e.target.value, 10), day: undefined })} className="w-full" />
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{weeks[weeks.length-1]?.[0]}</span><span>{weeks[0]?.[0]}</span>
        </div>
      </div>
      <div>
        <div className="text-xs mb-1">Day: {sel?.day ? format(new Date(sel.day), "MMM d, yyyy") : "-"}</div>
        <input type="range" min={0} max={Math.max(0, daysInWeek.length - 1)} value={dayIndex} onChange={e => setSel({ week: curWeek, day: daysInWeek[parseInt(e.target.value, 10)] })} className="w-full" />
        <div className="flex justify-between text-[10px] opacity-60">
          <span>{daysInWeek[daysInWeek.length-1] && format(new Date(daysInWeek[daysInWeek.length-1]), "MMM d")}</span>
          <span>{daysInWeek[0] && format(new Date(daysInWeek[0]), "MMM d")}</span>
        </div>
      </div>
    </div>
  );
}