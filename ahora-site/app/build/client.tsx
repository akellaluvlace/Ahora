// app/build/client.tsx
"use client";

import { DiaryEntry } from "../lib/types";
import { useBalanceTheme, BalanceThemeProvider } from "../components/BalanceThemeContext";
import { DiarySelectionProvider } from "../components/DiarySelectionContext";

// Import UI components
import ProgressBars from "../components/ProgressBars";
import TimelineControls from "../components/TimelineControls";
import BalancePie from "../components/BalancePie";
import TodaysChallenge from "../components/TodaysChallenge";
import TodayILearned from "../components/TodayILearned";
import CountersHeader from "../components/CountersHeader";
import AchievementCircles from "../components/AchievementCircles";
import SpecialThanks from "../components/SpecialThanks";
import EntriesList from "../components/EntriesList";

/**
 * This component acts as the "Theme Injector". It consumes the context
 * and applies the gradient colors as CSS variables to its children.
 */
function ThemedPageWrapper({ children }: { children: React.ReactNode }) {
  const { gradientStartColor, gradientEndColor } = useBalanceTheme();

  return (
    <div
      style={{
        "--gradient-start": gradientStartColor,
        "--gradient-end": gradientEndColor,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * This is the main Client Component for the page. It sets up all providers
 * and renders the entire UI, which now runs on the client.
 */
export default function BuildPageClient({ entries }: { entries: DiaryEntry[] }) {
  const entryDates = entries.map(e => e.date).sort();

  return (
    <DiarySelectionProvider>
      <BalanceThemeProvider entries={entries}>
        <ThemedPageWrapper>
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <h1 className="text-3xl font-bold">Ahora — Building in Public</h1>
            
            <div className="grid md:grid-cols-2 gap-4">
              <ProgressBars entryDates={entryDates} />
              <TimelineControls entries={entries} />
            </div>

            <BalancePie entries={entries} />
            <TodaysChallenge entries={entries} />
            <TodayILearned entries={entries} />
            <CountersHeader entries={entries} />
            <AchievementCircles entries={entries} />
            <SpecialThanks entries={entries} />

            <div className="pt-4">
              <h2 className="text-lg font-semibold mb-4">Daily Entries</h2>
              <EntriesList entries={entries} />
            </div>
          </div>
        </ThemedPageWrapper>
      </BalanceThemeProvider>
    </DiarySelectionProvider>
  );
}