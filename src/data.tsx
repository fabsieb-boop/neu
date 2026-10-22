import { createContext, useContext, type ReactNode } from "react";
import type { Dash, JournalRow, User } from "@/types";

export type Store = {
  dash: Dash;
  journal: JournalRow[];
  user: User;
  updateDash: (dash: Dash) => void;
  updateJournal: (journal: JournalRow[]) => void;
  logout: () => Promise<void>;
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
