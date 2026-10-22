import { createContext, useContext, type ReactNode } from "react";
import type { Dash, JournalRow } from "@/types";

export type Store = {
  dash: Dash;
  journal: JournalRow[];
  updateDash: (dash: Dash) => void;
};

const Ctx = createContext<Store | null>(null);

export function DataProvider({ value, children }: { value: Store; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDash(): Store {
  const value = useContext(Ctx);
  if (!value) throw new Error("Daten fehlen");
  return value;
}
