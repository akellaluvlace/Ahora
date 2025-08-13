// app/components/ProgressBars.tsx
import { differenceInCalendarDays } from "date-fns";
import { SITE } from '@/site.config';

export default function ProgressBars({ entryDates = [] }: { entryDates?: string[] }) {
  const today = new Date();

  // Determine start date: 1) Config, 2) Earliest entry, 3) Null
  const start: Date | null = SITE.projectStart
    ? new Date(SITE.projectStart)
    : (entryDates.length ? new Date(entryDates[entryDates.length - 1]) : null);

  const mk = (months: number) => {
    const total = Math.round(30.44 * months);
    if (!start) return { pct: 0, elapsed: 0, total, tbd: true };
    const elapsed = Math.max(0, differenceInCalendarDays(today, start));
    const pct = Math.min(100, Math.round((elapsed / total) * 100));
    return { pct, elapsed, total, tbd: false };
  };

  const mvp = mk(SITE.mvpMonths);
  const all = mk(SITE.overallMonths);

  const Bar = ({ label, v }: {label: string; v: {pct: number; elapsed: number; total: number; tbd: boolean}}) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs opacity-70">
        <span>{label}{v.tbd ? " (start: TBD)" : ""}</span>
        <span>{v.pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div className="h-2 rounded-full bg-black dark:bg-white transition-all" style={{ width: `${v.pct}%` }} />
      </div>
      <div className="text-[10px] opacity-60">
        {v.tbd ? "waiting for day 1…" : `${v.elapsed}/${v.total} days`}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border p-4 md:p-5 bg-white/60 dark:bg-neutral-900/60 space-y-3">
      <div className="text-sm font-semibold">Progress to Goals</div>
      <Bar label={`MVP (${SITE.mvpMonths} months)`} v={mvp} />
      <Bar label={`Overall (${SITE.overallMonths} months)`} v={all} />
    </div>
  );
}