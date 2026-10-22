import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, axis, DataTable, money, short } from "@/components/dash";

export function Buchungen() {
  const { dash, journal } = useDash();
  const [q, setQ] = useState("");
  const [art, setArt] = useState("Alle");
  const arten = ["Alle", ...Array.from(new Set(journal.map((j) => j.belegart)))];
  const rows = useMemo(() => journal.filter((j) => (art === "Alle" || j.belegart === art) && `${j.projekt} ${j.nr} ${j.kostenart} ${j.text} ${j.beleg}`.toLowerCase().includes(q.toLowerCase())), [art, journal, q]);
  const chart = dash.monate.map((m, i) => ({ m: short(m), Anzahl: rows.filter((r) => r.monat === i + 1).length }));
  return (
    <div>
      <PageHeader title="Buchungen" subtitle={`Auftragsjournal ${dash.jahr}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Panel title="Buchungen je Monat" subtitle={`${rows.length} Buchungen · Summe ${eur(rows.reduce((s, r) => s + r.wert, 0))}`}>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={36} />
                <Tooltip />
                <Bar dataKey="Anzahl" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Journal">
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Projekt, Beleg, Kostenart, Text…" className="w-full bg-transparent outline-none" />
            </label>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {arten.map((a) => <button key={a} onClick={() => setArt(a)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${art === a ? "bg-card shadow-card" : "text-muted-foreground"}`}>{a}</button>)}
            </div>
          </div>
          <DataTable rows={rows} max={640} cols={[
            { key: "d", label: "Datum", render: (r) => r.datum.split("-").reverse().join(".") },
            { key: "a", label: "Art", render: (r) => <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.belegart}</span> },
            { key: "b", label: "Beleg", render: (r) => <span className="text-muted-foreground">{r.beleg}</span> },
            { key: "p", label: "Projekt", render: (r) => <><p className="font-medium">{r.projekt || "—"}</p><p className="text-xs text-muted-foreground">{r.nr} · {r.region}</p></> },
            { key: "k", label: "Kostenart", render: (r) => r.kostenart },
            { key: "t", label: "Text", render: (r) => <span className="text-muted-foreground">{r.text}</span> },
            { key: "w", label: "Wert", right: true, render: (r) => money(r.wert) },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
