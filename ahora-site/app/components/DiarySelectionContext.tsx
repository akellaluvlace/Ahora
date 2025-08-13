// app/components/DiarySelectionContext.tsx
"use client";
import { createContext, useContext, useState, Dispatch, SetStateAction } from "react";

export type Selection = { week?: number; day?: string } | null;

const Ctx = createContext<{
  sel: Selection;
  setSel: Dispatch<SetStateAction<Selection>>;
}>({ sel: null, setSel: () => {} });

export function DiarySelectionProvider({ children }: { children: React.ReactNode }) {
  const [sel, setSel] = useState<Selection>(null);
  return <Ctx.Provider value={{ sel, setSel }}>{children}</Ctx.Provider>;
}

export function useDiarySelection() {
  return useContext(Ctx);
}