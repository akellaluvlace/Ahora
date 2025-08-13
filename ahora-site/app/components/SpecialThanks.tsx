// app/components/SpecialThanks.tsx
"use client";
import Image from "next/image";
import { parseISO } from "date-fns";
import { useDiarySelection } from "./DiarySelectionContext";
import { useMemo, useState } from "react";

type ThanksItem = { title: string; caption?: string; img?: string; link?: string; date?: string };
type Entry = { date: string; thanks?: Omit<ThanksItem, "date">[] };

export default function SpecialThanks({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;

  const items = useMemo(() => {
    const arr: ThanksItem[] = [];
    entries.forEach(e => {
      if (cutoff && parseISO(e.date) > cutoff) return;
      (e.thanks || []).forEach(t => arr.push({ ...t, date: e.date }));
    });
    return arr.sort((a, b) => +new Date(b.date!) - +new Date(a.date!));
  }, [entries, cutoff]);

  const [active, setActive] = useState<ThanksItem | null>(null);

  if (!items.length) return null;

  return (
    <>
      <section className="rounded-2xl border p-4 md:p-6 bg-white/60 dark:bg-neutral-900/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Special Thanks</h2>
          <div className="text-xs opacity-70">{items.length} items</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {items.map((it, idx) => (
            <button key={idx} className="text-left rounded-xl border overflow-hidden bg-white/70 dark:bg-neutral-900/70 hover:shadow-md transition-shadow" onClick={() => setActive(it)}>
              {it.img && (
                <div className="relative w-full h-40">
                  <Image src={it.img} alt={it.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                </div>
              )}
              <div className="p-3 space-y-1">
                <div className="text-sm font-medium">{it.title}</div>
                {it.caption && <div className="text-xs opacity-70">{it.caption}</div>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setActive(null)}>
          <div className="max-w-3xl w-[92%] bg-white dark:bg-neutral-900 rounded-2xl border overflow-hidden" onClick={e => e.stopPropagation()}>
            {active.img && (
              <div className="relative w-full h-[60vh]">
                <Image src={active.img} alt={active.title} fill sizes="100vw" className="object-contain bg-black/80" />
              </div>
            )}
            <div className="p-4">
              <div className="font-semibold mb-1">{active.title}</div>
              {active.caption && <div className="text-sm opacity-80 mb-2">{active.caption}</div>}
              {active.link && <a href={active.link} target="_blank" rel="noopener noreferrer" className="text-sm underline">Open original</a>}
              <div className="mt-3">
                <button className="text-sm opacity-70" onClick={() => setActive(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}