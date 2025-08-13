// app/components/DiaryEntryCard.tsx

"use client";
import { format } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DiaryEntry, Bullet } from "../lib/types";

export default function DiaryEntryCard({
  entry,
  show,
}: {
  entry: DiaryEntry;
  show: { progress: boolean; dev: boolean; social: boolean; personal: boolean };
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  const Section = ({
    icon,
    title,
    items,
    isDev,
  }: {
    icon: string;
    title: string;
    items?: Bullet[];
    isDev?: boolean;
  }) => {
    if (!items?.length) return null;

    // This component now correctly handles the two types of `Bullet`
    const BulletItem = ({ b }: { b: Bullet }) => {
      // Case 1: The bullet is a simple string.
      if (typeof b === "string") {
        return <li className="text-sm leading-6">{b}</li>;
      }

      // Case 2: The bullet is a rich object. TypeScript now knows
      // that `b` has properties like `.text`, `.code`, `.img`, etc.

      // Sub-case: Handle code blocks for the "Dev" section.
      if (isDev && b.code) {
        return (
          <li className="space-y-2">
            <div className="text-sm leading-6">{b.text}</div>
            <div className="rounded-lg overflow-hidden border">
              <SyntaxHighlighter
                language={b.lang || "text"}
                style={vscDarkPlus}
                customStyle={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}
                wrapLongLines
              >
                {b.code.trimEnd()}
              </SyntaxHighlighter>
            </div>
          </li>
        );
      }

      // Sub-case: Handle regular bullets with optional images and links.
      return (
        <li className="text-sm leading-6 flex items-start gap-2">
          <span className="flex-1">
            {b.link ? (
              <a href={b.link} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                {b.text}
              </a>
            ) : (
              b.text
            )}
          </span>
          {b.img && (
            <button
              onClick={() => setLightbox(b.img!)}
              className="shrink-0 rounded overflow-hidden border hover:opacity-90"
              title="Open image"
            >
              <Image
                src={b.img}
                alt={b.text}
                width={64}
                height={48}
                className="object-cover w-16 h-12"
              />
            </button>
          )}
        </li>
      );
    };

    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold opacity-70">
          {icon} {title}
        </div>
        <ul className="list-disc pl-5 space-y-1">
          {items.map((b, i) => (
            <BulletItem key={i} b={b} />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <article className="rounded-2xl border p-4 md:p-6 shadow-sm bg-white/60 dark:bg-neutral-900/60">
        <header className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold">{entry.title}</h3>
            <div className="text-xs opacity-70">
              {format(new Date(entry.date), "MMM d, yyyy")}{" "}
              {entry.mood ? `• ${entry.mood}` : ""}
            </div>
          </div>
          {entry.metrics && (
            <div className="text-xs opacity-70 space-x-3">
              {Object.entries(entry.metrics).map(([k, v]) => (
                <span key={k}>
                  {k}: <b>{v}</b>
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          {show.progress && <Section icon="✔️" title="Overall" items={entry.progress} />}
          {show.dev && <Section icon="🔧" title="Dev" items={entry.dev} isDev />}
          {show.social && <Section icon="🤝" title="Social" items={entry.social} />}
          {show.personal && <Section icon="🧠" title="Personal" items={entry.personal} />}
        </div>
        
        {entry.discussion && (
          <footer className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
            <span className="text-xs opacity-70">Discuss on:</span>
            {entry.discussion.x && <a href={entry.discussion.x} target="_blank" rel="noopener noreferrer" className="text-xs rounded-full px-3 py-1 border bg-white/80 dark:bg-neutral-900/80 hover:border-black dark:hover:border-white">X / Twitter</a>}
            {entry.discussion.linkedin && <a href={entry.discussion.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs rounded-full px-3 py-1 border bg-white/80 dark:bg-neutral-900/80 hover:border-blue-600">LinkedIn</a>}
          </footer>
        )}
      </article>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-4xl w-[92%] rounded-2xl bg-white dark:bg-neutral-900 border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[70vh] bg-black">
              <Image
                src={lightbox}
                alt="Preview"
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            <div className="p-3">
              <button className="text-sm opacity-70" onClick={() => setLightbox(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}