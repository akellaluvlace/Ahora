// app/components/BalancePie.tsx
"use client";
import { parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useDiarySelection } from "./DiarySelectionContext";
import { colorForPct } from "@/app/lib/balance-colors";

type Bullet = string | { text: string };
type Entry = {
  date: string;
  progress?: Bullet[];
  dev?: Bullet[];
  social?: Bullet[];
  personal?: Bullet[];
};

const LABELS = { progress: "Overall", dev: "Dev", social: "Social", personal: "Personal" } as const;

// Minimal inline Font Awesome Free SVGs (no external deps)
function FAIcon({
  name,
  className,
  style,
}: {
  name: "progress" | "dev" | "social" | "personal";
  className?: string;
  style?: React.CSSProperties;
}) {
  // viewBox and path data from Font Awesome Free solid icons
  if (name === "progress") {
    // chart-pie
    return (
      <svg viewBox="0 -16 544 544" className={className} aria-hidden="true" style={style}>
        <path
          fill="currentColor"
          d="M527.79 288H290.5l158.03 158.03c6.04 6.04 15.98 6.53 22.19.68 38.7-36.46 65.32-85.61 73.13-140.86 1.34-9.46-6.51-17.85-16.06-17.85zm-15.83-64.8C503.72 103.74 408.26 8.28 288.8.04 279.68-.59 272 7.1 272 16.24V240h223.77c9.14 0 16.82-7.68 16.19-16.8zM224 288V50.71c0-9.55-8.39-17.4-17.84-16.06C86.99 51.49-4.1 155.6.14 280.37 4.5 408.51 114.83 513.59 243.03 511.98c50.4-.63 96.97-16.87 135.26-44.03 7.9-5.6 8.42-17.23 1.57-24.08L224 288z"
        />
      </svg>
    );
  }
  if (name === "dev") {
    // code-branch
    return (
      <svg viewBox="-64 0 512 512" className={className} aria-hidden="true" style={style}>
        <path
          fill="currentColor"
          d="M384 144c0-44.2-35.8-80-80-80s-80 35.8-80 80c0 36.4 24.3 67.1 57.5 76.8-.6 16.1-4.2 28.5-11 36.9-15.4 19.2-49.3 22.4-85.2 25.7-28.2 2.6-57.4 5.4-81.3 16.9v-144c32.5-10.2 56-40.5 56-76.3 0-44.2-35.8-80-80-80S0 35.8 0 80c0 35.8 23.5 66.1 56 76.3v199.3C23.5 365.9 0 396.2 0 432c0 44.2 35.8 80 80 80s80-35.8 80-80c0-34-21.2-63.1-51.2-74.6 3.1-5.2 7.8-9.8 14.9-13.4 16.2-8.2 40.4-10.4 66.1-12.8 42.2-3.9 90-8.4 118.2-43.4 14-17.4 21.1-39.8 21.6-67.9 31.6-10.8 54.4-40.7 54.4-75.9zM80 64c8.8 0 16 7.2 16 16s-7.2 16-16 16-16-7.2-16-16 7.2-16 16-16zm0 384c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16zm224-320c8.8 0 16 7.2 16 16s-7.2 16-16 16-16-7.2-16-16 7.2-16 16-16z"
        />
      </svg>
    );
  }
  if (name === "social") {
    // users
    return (
      <svg viewBox="0 -64 640 640" className={className} aria-hidden="true" style={style}>
        <path
          fill="currentColor"
          d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"
        />
      </svg>
    );
  }
  // personal -> heart
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" style={style}>
      <path
        fill="currentColor"
        d="M458.4 64.3C400.6 15.7 311.3 23 256 79.3 200.7 23 111.4 15.6 53.6 64.3-21.6 127.6-10.6 230.8 43 285.5l175.4 178.7c10 10.2 23.4 15.9 37.6 15.9 14.3 0 27.6-5.6 37.6-15.8L469 285.6c53.5-54.7 64.7-157.9-10.6-221.3zm-23.6 187.5L259.4 430.5c-2.4 2.4-4.4 2.4-6.8 0L77.2 251.8c-36.5-37.2-43.9-107.6 7.3-150.7 38.9-32.7 98.9-27.8 136.5 10.5l35 35.7 35-35.7c37.8-38.5 97.8-43.2 136.5-10.6 51.1 43.1 43.5 113.9 7.3 150.8z"
      />
    </svg>
  );
}

// Animation keyframes injected directly for self-containment
const keyframesCSS = `
  @keyframes rotate1 {
    from { transform: rotateX(50deg) rotateZ(110deg); }
    to { transform: rotateX(50deg) rotateZ(470deg); }
  }
  @keyframes rotate2 {
    from { transform: rotateX(20deg) rotateY(50deg) rotateZ(20deg); }
    to { transform: rotateX(20deg) rotateY(50deg) rotateZ(380deg); }
  }
  @keyframes rotate3 {
    from { transform: rotateX(40deg) rotateY(130deg) rotateZ(450deg); }
    to { transform: rotateX(40deg) rotateY(130deg) rotateZ(90deg); }
  }
  @keyframes rotate4 {
    from { transform: rotateX(70deg) rotateZ(270deg); }
    to { transform: rotateX(70deg) rotateZ(630deg); }
  }
`;

const animationClasses = ["rotate1", "rotate2", "rotate3", "rotate4"];

export default function BalancePie({ entries }: { entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;

  const filtered = useMemo(() => {
    if (!cutoff) return entries;
    return entries.filter((e) => parseISO(e.date) <= cutoff);
  }, [entries, cutoff]);

  const count = (k: keyof typeof LABELS) =>
    filtered.reduce((sum, e) => sum + ((e[k] as Bullet[] | undefined)?.length ?? 0), 0);

  const counts = {
    progress: count("progress"),
    dev: count("dev"),
    social: count("social"),
    personal: count("personal"),
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const slices = useMemo(
    () =>
      (Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => {
        const pct = total ? (counts[k] / total) * 100 : 0;
        return { key: k, label: LABELS[k], count: counts[k], pct, hex: colorForPct(pct) };
      }),
    [total, counts]
  );

  // --- SVG geometry helpers (degrees start at 12 o'clock)
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const polar = (cx: number, cy: number, r: number, deg: number) => {
    const a = toRad(deg);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const arcSlicePath = (
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    startDeg: number,
    endDeg: number
  ) => {
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    const p1 = polar(cx, cy, rOuter, startDeg);
    const p2 = polar(cx, cy, rOuter, endDeg);
    const p3 = polar(cx, cy, rInner, endDeg);
    const p4 = polar(cx, cy, rInner, startDeg);
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
      "Z",
    ].join(" ");
  };

  const angleSlices = useMemo(() => {
    if (!total) {
      return [{ key: "empty", label: "", count: 0, pct: 100, hex: "#e5e7eb", startDeg: 0, endDeg: 360 }];
    }
    let acc = 0;
    return slices.map((s) => {
      const start = acc;
      const end = acc + s.pct * 3.6; // 100% -> 360deg
      acc = end;
      return { ...s, startDeg: start, endDeg: end };
    });
  }, [slices, total]);

  const [hoverKey, setHoverKey] = useState<keyof typeof LABELS | null>(null);
  const hoverSliceData = useMemo(() => {
    if (!hoverKey) return null;
    return slices.find((s) => s.key === hoverKey);
  }, [hoverKey, slices]);

  return (
    <section className="rounded-2xl border p-4 md:p-5 bg-white/60 dark:bg-neutral-900/60">
      <style>{keyframesCSS}</style>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Balance Pie</div>
        <div className="text-xs opacity-70">{total} items</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-4">
        {/* Left Side: Animation (Fully responsive) */}
        <div className="relative flex justify-center items-center w-full max-w-64 aspect-square mx-auto">
          {slices.map((slice, index) => {
            const gradientId = `animGrad-${slice.key}`;
            const colorStart = colorForPct(Math.max(0, slice.pct - 2.5));
            const colorEnd = colorForPct(slice.pct + 2.5);

            return (
              <svg
                key={slice.key}
                viewBox="0 0 100 100"
                className="w-full h-full absolute"
                style={{
                  animation: `${animationClasses[index]} 2s linear infinite`,
                  overflow: "visible",
                }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={colorStart} />
                    <stop offset="100%" stopColor={colorEnd} />
                  </linearGradient>
                </defs>
                <path
                  d="M 5 50 A 45 45 0 0 0 95 50" // Bottom semi-circle arc
                  stroke={`url(#${gradientId})`}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            );
          })}

          {/* Inner, proper SVG donut pie */}
          <div className="absolute w-[45%] h-[45%] rounded-full">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full"
              role="img"
              aria-label="Pie chart of balance across categories"
            >
              <title>Balance Pie</title>
              {angleSlices.map((s, i) => {
                const d = arcSlicePath(50, 50, 38, 24, s.startDeg, s.endDeg);
                const key = String(s.key) as keyof typeof LABELS;
                const isHovered = hoverKey === key;
                return (
                  <path
                    key={String(s.key) + i}
                    d={d}
                    fill={s.hex}
                    strokeWidth={4}
                    className={`stroke-white dark:stroke-neutral-900 transition-all duration-200 ${
                      isHovered ? "brightness-125" : ""
                    }`}
                    style={{
                      transform: isHovered ? "scale(1.05)" : "scale(1)",
                      transformOrigin: "center",
                      transformBox: "view-box",
                    }}
                    onMouseEnter={() => total > 0 && setHoverKey(key)}
                    onMouseLeave={() => setHoverKey(null)}
                    role={s.key === "empty" ? "presentation" : "button"}
                    aria-label={
                      s.key === "empty"
                        ? undefined
                        : `${LABELS[key]}: ${total ? Math.round((counts[key] / total) * 100) : 0}%`
                    }
                  />
                );
              })}
            </svg>

            {/* Center hover readout */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {hoverSliceData && (
                <FAIcon
                  name={hoverSliceData.key}
                  className="w-10 h-10"
                  style={{ color: hoverSliceData.hex }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Stats with icons */}
        <div className="space-y-3">
          <ul className="space-y-1">
            {slices.map((s) => {
              const isHovered = hoverKey === s.key;
              return (
                <li
                  key={s.key}
                  className={`flex items-center justify-between gap-3 p-2 -mx-2 rounded-lg cursor-default transition-all duration-200 ${
                    isHovered ? "bg-black/5 dark:bg-white/5" : ""
                  }`}
                  onMouseEnter={() => total > 0 && setHoverKey(s.key)}
                  onMouseLeave={() => setHoverKey(null)}
                >
                  <div className="flex items-center gap-2">
                    <FAIcon name={s.key} className="w-4 h-4" style={{ color: s.hex }} />
                    <span className="text-sm font-medium" style={{ color: s.hex }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                    {total ? `${Math.round(s.pct)}%` : "0%"}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="text-[10px] opacity-60 text-center md:text-left">
            Cyan: &gt;25% • Blue/Purple: 15-25% • Faded Blue: &lt;15%
          </div>
        </div>
      </div>
    </section>
  );
}