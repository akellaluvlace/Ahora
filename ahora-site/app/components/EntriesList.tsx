// app/components/EntriesList.tsx

"use client"; // <-- This directive marks the entire file as a Client Component.

import { useMemo } from 'react';
import { DiaryEntry } from "../lib/types";
import { useDiarySelection } from "./DiarySelectionContext";
import DiaryEntryCard from "./DiaryEntryCard";

export default function EntriesList({ entries }: { entries: DiaryEntry[] }) {
  const { sel } = useDiarySelection();
  
  const filtered = useMemo(() => {
    if (sel?.day) return entries.filter(e => e.date === sel.day);
    return entries.slice(0, 5); // Default to showing the latest 5 entries
  }, [sel, entries]);

  const showSections = { progress: true, dev: true, social: true, personal: true };
  
  return (
    <div className="grid gap-4">
      {filtered.length > 0 
        ? filtered.map(e => <DiaryEntryCard key={e.slug} entry={e} show={showSections} />)
        : <div className="text-sm opacity-70 text-center py-8">No entry for this selection.</div>
      }
    </div>
  );
}