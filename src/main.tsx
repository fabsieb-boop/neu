import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { DataProvider } from "@/data";
import type { Dash, JournalRow } from "@/types";
import "@/styles.css";

function Root() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [journal, setJournal] = useState<JournalRow[] | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => { if (!r.ok) throw new Error("Dashboard"); return r.json(); }),
      fetch("/api/journal").then((r) => { if (!r.ok) throw new Error("Journal"); return r.json(); }),
    ]).then(([d, j]) => { setDash(d); setJournal(j); }).catch(() => setFehler("Die Zahlen konnten nicht geladen werden."));
  }, []);

  if (fehler) return <p className="grid min-h-screen place-items-center text-sm text-negative">{fehler}</p>;
  if (!dash || !journal) return <p className="grid min-h-screen place-items-center text-sm text-muted-foreground">Zahlen werden geladen …</p>;
  return (
    <DataProvider value={{ dash, journal }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DataProvider>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
