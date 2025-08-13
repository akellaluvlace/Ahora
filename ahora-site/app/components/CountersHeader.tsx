// app/components/CountersHeader.tsx
"use client";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useMemo } from "react";
import { useDiarySelection } from "./DiarySelectionContext";
import { SITE } from '@/site.config';

type Entry = { date: string; hours?: number; money?: number };

export default function CountersHeader({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;

  const filtered = useMemo(() => {
    if (!cutoff) return entries;
    return entries.filter(e => parseISO(e.date) <= cutoff);
  }, [entries, cutoff]);

  let buildDay: number;
  if (!SITE.projectStart || SITE.countersMode === "entries") {
    buildDay = filtered.length || 0;
  } else {
    buildDay = differenceInCalendarDays(cutoff || new Date(), parseISO(SITE.projectStart)) + 1;
    if (buildDay < 0) buildDay = 0;
  }

  const totals = filtered.reduce((acc, e) => {
    acc.hours += e.hours || 0;
    acc.money += e.money || 0;
    return acc;
  }, { hours: 0, money: 0 });

  const Card = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl border p-4 bg-white/60 dark:bg-neutral-900/60 flex flex-col">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card label="Build day" value={buildDay} />
      <Card label="Hours spent (to date)" value={totals.hours} />
      <Card label="Money spent (to date)" value={`€${totals.money}`} />
    </div>
  );
}