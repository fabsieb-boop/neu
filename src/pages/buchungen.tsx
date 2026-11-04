import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, axis, DataTable, money, short } from "@/components/dash";

export function Buchungen() {
  const { dash, journal } = useDash();
  const [q, setQ] = useState("");
  const [art, setArt] = useState("Alle");
  const [monat, setMonat] = useState(dash.aktuellerMonat ?? dash.letzterIst);
  const arten = ["Alle", ...Array.from(new Set(journal.map((j) => j.belegart).filter(Boolean)))];
  const gesucht = useMemo(() => journal.filter((j) => (art === "Alle" || j.belegart === art) && `${j.projekt} ${j.nr} ${j.kostenart} ${j.text} ${j.beleg}`.toLowerCase().includes(q.toLowerCase())), [art, journal, q]);
  const rows = gesucht.filter((row) => row.monat === monat);
  const chart = dash.monate.map((name, index) => ({ m: short(name), Anzahl: gesucht.filter((row) => row.monat === index + 1).length }));
  const name = dash.monate[monat - 1] ?? "";
  const summe = rows.reduce((total, row) => total + row.wert, 0);
  return (
    <div>
      <PageHeader title="Monatssicht" subtitle={`${name} ${dash.jahr}: ${rows.length.toLocaleString("de-DE")} Buchungen, Summe ${eur(summe)}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Panel title="Buchungen je Monat" subtitle={`${chart.reduce((sum, entry) => sum + entry.Anzahl, 0).toLocaleString("de-DE")} Buchungen im Filter.`}>
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
        <Panel title={`Journal ${name}`}>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {dash.monate.map((label, index) => (
                <button key={label} onClick={() => setMonat(index + 1)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${monat === index + 1 ? "bg-card shadow-card" : "text-muted-foreground"}`}>{label.slice(0, 3)}</button>
              ))}
            </div>
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Projekt, Beleg, Kostenart, Text…" className="w-full bg-transparent outline-none" />
            </label>
            {arten.length > 1 && (
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                {arten.map((a) => <button key={a} onClick={() => setArt(a)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${art === a ? "bg-card shadow-card" : "text-muted-foreground"}`}>{a}</button>)}
              </div>
            )}
          </div>
          <DataTable rows={rows} max={640} cols={[
            { key: "d", label: "Datum", render: (r) => r.datum.split("-").reverse().join(".") },
            { key: "b", label: "Beleg", render: (r) => <span className="text-muted-foreground">{r.beleg}</span> },
            { key: "p", label: "Projekt", render: (r) => <><p className="font-medium">{r.projekt || "—"}</p><p className="text-xs text-muted-foreground"><Link to={`/projektsuche?nr=${encodeURIComponent(r.nr)}`} className="hover:underline">{r.nr}</Link> · {r.region}</p></> },
            { key: "k", label: "Kostenart", render: (r) => r.kostenart },
            { key: "t", label: "Text", render: (r) => <span className="text-muted-foreground">{r.text}</span> },
            { key: "w", label: "Wert", right: true, render: (r) => money(r.wert) },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
