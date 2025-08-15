// app/components/BalanceThemeContext.tsx
"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { parseISO } from "date-fns";
import { colorForPct } from "@/app/lib/balance-colors";
import { useDiarySelection } from "./DiarySelectionContext";

type Bullet = string | { text: string };
type Entry = {
  date: string;
  progress?: Bullet[];
  dev?: Bullet[];
  social?: Bullet[];
  personal?: Bullet[];
};

type BalanceThemeContextType = {
  gradientStartColor: string;
  gradientEndColor: string;
};

const BalanceThemeContext = createContext<BalanceThemeContextType>({
  gradientStartColor: "#cfd7e3", // Default to --color-border
  gradientEndColor: "#cfd7e3",
});

export function BalanceThemeProvider({ children, entries }: { children: ReactNode; entries: Entry[] }) {
  const { sel } = useDiarySelection();
  const cutoff = sel?.day ? parseISO(sel.day) : null;

  const { gradientStartColor, gradientEndColor } = useMemo(() => {
    const filtered = !cutoff ? entries : entries.filter((e) => parseISO(e.date) <= cutoff);
    
    const count = (k: "progress" | "dev" | "social" | "personal") =>
      filtered.reduce((sum, e) => sum + ((e[k] as Bullet[] | undefined)?.length ?? 0), 0);
    
    const progressCount = count("progress");
    const total = count("progress") + count("dev") + count("social") + count("personal");
    
    const overallPct = total > 0 ? (progressCount / total) * 100 : 0;
    
    const colorStart = colorForPct(Math.max(0, overallPct - 2.5));
    const colorEnd = colorForPct(overallPct + 2.5);
    
    return { gradientStartColor: colorStart, gradientEndColor: colorEnd };
  }, [entries, cutoff]);

  return (
    <BalanceThemeContext.Provider value={{ gradientStartColor, gradientEndColor }}>
      {children}
    </BalanceThemeContext.Provider>
  );
}

export const useBalanceTheme = () => useContext(BalanceThemeContext);