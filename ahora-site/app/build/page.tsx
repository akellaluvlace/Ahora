// app/build/page.tsx
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { useMemo } from 'react';
import { DiaryEntry } from "../lib/types"; // <-- MODIFIED: Import shared type

// Import all components (using relative paths as you have them)
import { DiarySelectionProvider, useDiarySelection } from "../components/DiarySelectionContext";
import ProgressBars from "../components/ProgressBars";
import TimelineControls from "../components/TimelineControls";
import BalancePie from "../components/BalancePie";
import TodaysChallenge from "../components/TodaysChallenge";
import TodayILearned from "../components/TodayILearned";
import CountersHeader from "../components/CountersHeader";
import AchievementCircles from "../components/AchievementCircles";
import SpecialThanks from "../components/SpecialThanks";
import DiaryEntryCard from "../components/DiaryEntryCard";

export const dynamic = "force-static"; // Force Static Site Generation (SSG)

function loadEntries(): DiaryEntry[] { // <-- MODIFIED: Function returns our shared type
  const dir = path.join(process.cwd(), "content", "diary");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".mdx"));
  const entries = files.map(filename => {
    const slug = filename.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(dir, filename), "utf8");
    const { data } = matter(raw);
    return { slug, ...data } as DiaryEntry; // <-- MODIFIED: Cast data to our shared type
  });
  // Sort entries by date, newest first
  return entries.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export default function BuildPage() {
  const entries = loadEntries();
  const entryDates = entries.map(e => e.date).sort(); // Oldest to newest for progress calc

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Ahora — Building in Public</h1>
      <DiarySelectionProvider>
        {/* Top Row: Progress, Timeline, and Balance */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProgressBars entryDates={entryDates} />
          <BalancePie entries={entries} />
          <TimelineControls entries={entries} />
        </div>

        {/* Challenge & Learning Blocks */}
        <TodaysChallenge entries={entries} />
        <TodayILearned entries={entries} />

        {/* Aggregate Data Blocks */}
        <CountersHeader entries={entries} />
        <AchievementCircles entries={entries} />
        <SpecialThanks entries={entries} />

        {/* The Diary Entry Feed */}
        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-4">Daily Entries</h2>
          <EntriesList entries={entries} />
        </div>
      </DiarySelectionProvider>
    </div>
  );
}

function EntriesList({ entries }: { entries: DiaryEntry[] }) {
  "use client";
  const { sel } = useDiarySelection();
  
  const filtered = useMemo(() => {
    if (sel?.day) return entries.filter(e => e.date === sel.day);
    return entries.slice(0, 5);
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