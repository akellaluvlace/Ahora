// app/components/AchievementCircles.tsx
"use client";
import { useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { useDiarySelection } from "./DiarySelectionContext";

type Bullet = string | { text: string };
type Entry = {
  date: string;
  progress?: Bullet[]; dev?: Bullet[]; social?: Bullet[]; personal?: Bullet[];
  social_posts?: string[]; followers_delta?: Record<string, number>;
};

const SECTIONS = [
  { key: "progress", label: "Overall", icon: "✔️" },
  { key: "dev", label: "Dev", icon: "🔧" },
  { key: "social", label: "Social", icon: "🤝" },
  { key: "personal", label: "Personal", icon: "🧠" },
] as const;

export default function AchievementCircles({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;
  
  const filtered = useMemo(() => 
    !cutoff ? entries : entries.filter(e => parseISO(e.date) <= cutoff), 
    [entries, cutoff]
  );
  
  const toText = (it: Bullet) => (typeof it === "string" ? it : it?.text).trim() || "";
  const join = (k: keyof Entry) => filtered.flatMap(e => ((e as any)[k] as Bullet[] | undefined)?.map(toText) ?? []);

  const lists = useMemo(() => {
    const followers = filtered.reduce((acc, e) => {
      Object.entries(e.followers_delta || {}).forEach(([k, v]) => acc[k] = (acc[k] || 0) + (v || 0));
      return acc;
    }, {} as Record<string, number>);
    
    return {
      progress: join("progress"), dev: join("dev"), social: join("social"), personal: join("personal"),
      posts: filtered.reduce((s, e) => s + (e.social_posts?.length || 0), 0),
      followers,
    };
  }, [filtered]);
  
  const [active, setActive] = useState<keyof typeof lists | null>(null);
  
  const Circle = ({ k, label, icon }: { k: keyof typeof lists, label: string, icon: string }) => (
    <button onClick={() => setActive(k)} className="size-24 rounded-full border flex flex-col items-center justify-center shadow-sm bg-white/60 dark:bg-neutral-900/60">
      <div className="text-lg">{icon}</div>
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-base font-semibold">{(lists as any)[k].length || 0}</div>
    </button>
  );

  return (
    <div className="rounded-2xl border p-4 md:p-6 bg-white/60 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Achievements</div>
        <div className="text-xs opacity-70">
          Posts: {lists.posts} · {Object.entries(lists.followers).map(([k, v]) => `${k} +${v}`).join(" ")}
        </div>
      </div>
      <div className="flex gap-3 flex-wrap justify-center sm:justify-start">
        {SECTIONS.map(s => <Circle key={s.key} k={s.key} label={s.label} icon={s.icon} />)}
      </div>

      {active && Array.isArray((lists as any)[active]) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setActive(null)}>
          <div className="max-w-lg w-[92%] rounded-2xl bg-white dark:bg-neutral-900 border p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-semibold capitalize">{String(active)} — All Items</div>
              <button className="text-sm opacity-70" onClick={() => setActive(null)}>Close</button>
            </div>
            <ul className="list-disc pl-5 space-y-1 max-h-[70vh] overflow-y-auto">
              {(lists as any)[active].map((it: string, i: number) => <li key={i} className="text-sm leading-6">{it}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}