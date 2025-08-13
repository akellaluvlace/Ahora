// app/components/TodayILearned.tsx
"use client";
import { parseISO } from "date-fns";
import { useDiarySelection } from "./DiarySelectionContext";
import { useMemo, useState } from "react";

type Entry = { date: string; til?: string | string[] };

export default function TodayILearned({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  
  const entry = useMemo(() => {
    if (!entries.length) return null;
    if (sel?.day) return entries.find(e => e.date === sel.day && e.til) || null;
    return entries.find(e => !!e.til) || null; // Entries are sorted newest first
  }, [entries, sel?.day]);

  if (!entry?.til) return null;

  const list = Array.isArray(entry.til) ? entry.til : [entry.til];
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? list : list.slice(0, 2);

  return (
    <section className="rounded-2xl border p-4 md:p-5 bg-white/60 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">💡 Today I Learned</div>
        {list.length > 2 && (
          <button onClick={() => setExpanded(v => !v)} className="text-xs underline opacity-80">
            {expanded ? "Show less" : `Show all (${list.length})`}
          </button>
        )}
      </div>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        {show.map((t, i) => <li key={i} className="text-sm leading-6">{t}</li>)}
      </ul>
      <div className="mt-2 text-[10px] opacity-60">
        {sel?.day ? `For ${sel.day}` : "Latest entry"}
      </div>
    </section>
  );
}