import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, DataTable } from "@/components/dash";

const STUFE = ["Leistung", "Variabel", "Fix"];
const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function Stammdaten() {
  const { dash } = useDash();
  const [tab, setTab] = useState<"projekte" | "kostenarten">("projekte");
  const status = Object.entries(dash.projektstamm.reduce<Record<string, number>>((a, p) => ({ ...a, [p.status || "ohne"]: (a[p.status || "ohne"] ?? 0) + 1 }), {})).map(([n, v]) => ({ n, v }));
  const gruppen = Object.entries(dash.kostenarten.reduce<Record<string, number>>((a, k) => ({ ...a, [k.gruppe]: (a[k.gruppe] ?? 0) + 1 }), {})).map(([n, v]) => ({ n, v }));
  const pie = tab === "projekte" ? status : gruppen;
  return (
    <div>
      <PageHeader title="Stammdaten" subtitle="Projektstamm und Kostenarten" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
          <button onClick={() => setTab("projekte")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "projekte" ? "bg-card shadow-card" : "text-muted-foreground"}`}>Projektstamm ({dash.projektstamm.length})</button>
          <button onClick={() => setTab("kostenarten")} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === "kostenarten" ? "bg-card shadow-card" : "text-muted-foreground"}`}>Kostenarten ({dash.kostenarten.length})</button>
        </div>
        <div className="grid gap-6 lg:grid-cols-4">
          <Panel title={tab === "projekte" ? "Status" : "GuV-Gruppen"}>
            <div className="h-44">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="v" nameKey="n" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                    {pie.map((_, i) => <Cell key={i} fill={C[i % 5]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {pie.map((p, i) => <li key={p.n} className="flex justify-between gap-2"><span className="flex items-center gap-2 truncate"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: C[i % 5] }} />{p.n}</span><span className="font-semibold">{p.v}</span></li>)}
            </ul>
          </Panel>
          <Panel title={tab === "projekte" ? "Projekte" : "Kostenarten"} className="lg:col-span-3">
            {tab === "projekte" ? (
              <DataTable rows={dash.projektstamm} cols={[
                { key: "n", label: "Projekt", render: (r) => <><p className="font-medium">{r.name || "—"}</p><p className="text-xs text-muted-foreground">{r.nr} · {r.typ}</p></> },
                { key: "r", label: "Region", render: (r) => r.region },
                { key: "s", label: "Status", render: (r) => <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{r.status}</span> },
                { key: "bu", label: "Budget Umsatz", right: true, render: (r) => eur(r.budgetUmsatz) },
                { key: "bk", label: "Budget Kosten", right: true, render: (r) => eur(r.budgetKosten) },
              ]} />
            ) : (
              <DataTable rows={dash.kostenarten} cols={[
                { key: "k", label: "Konto", render: (r) => <span className="font-mono text-xs">{r.konto}</span> },
                { key: "b", label: "Bezeichnung", render: (r) => r.bezeichnung },
                { key: "s", label: "DB-Stufe", render: (r) => <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{STUFE[r.stufe] ?? `Stufe ${r.stufe}`}</span> },
                { key: "g", label: "GuV-Gruppe", render: (r) => <span className="text-muted-foreground">{r.gruppe}</span> },
              ]} />
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
