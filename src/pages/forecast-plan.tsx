import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, Kpi, axis } from "@/components/dash";

const ARTEN: Record<string, string> = { umsatz: "Umsatz", kosten: "Kosten", ba: "Bestand" };

export function ForecastPlan() {
  const { dash } = useDash();
  const [filter, setFilter] = useState("alle");
  const [q, setQ] = useState("");
  const planzeilen = dash.forecastPlan.filter((e) => e.art === "plan");
  const rows = dash.forecastPlan.filter((e) => (filter === "alle" || e.groesse === filter) && `${e.nr} ${e.name} ${e.region} ${e.art}`.toLowerCase().includes(q.toLowerCase()));
  const sum = (g: string, angezeigt = false) => planzeilen.filter((e) => e.groesse === g).reduce((s, e) => s + (angezeigt && g === "umsatz" ? -e.wert : e.wert), 0);
  const chart = useMemo(() => dash.monate.map((m, i) => {
    const mon = planzeilen.filter((e) => e.monat === i + 1);
    const s = (g: string) => mon.filter((e) => e.groesse === g).reduce((a, e) => a + e.wert, 0);
    return { m: m.slice(0, 3), Umsatz: -s("umsatz"), Kosten: s("kosten"), Bestand: s("ba") };
  }), [planzeilen, dash.monate]);

  return (
    <div>
      <PageHeader title="Forecast-Plan" subtitle="Gespeicherte Planzeilen. Umsatz wird in der Summe mit umgekehrtem Vorzeichen gezeigt." />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Umsatz angezeigt" value={sum("umsatz", true)} hint="minus gespeicherter Wert" />
          <Kpi label="Kosten geplant" value={sum("kosten")} hint="gespeicherter Wert" />
          <Kpi label="Bestandsänderung" value={sum("ba")} hint="gespeicherter Wert" signed />
          <Kpi label="Ergebnis Plan" value={sum("umsatz", true) + sum("ba") - sum("kosten")} hint="Umsatz + Bestand − Kosten" signed />
        </section>
        <Panel title="Plan je Monat" subtitle="Umsatz bereits mit umgekehrtem Vorzeichen">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={chart} stackOffset="sign">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => eur(v)} cursor={{ fill: "var(--muted)" }} />
                <Legend iconType="circle" />
                <Bar dataKey="Umsatz" stackId="b" fill="var(--chart-1)" />
                <Bar dataKey="Bestand" stackId="b" fill="var(--chart-3)" />
                <Bar dataKey="Kosten" stackId="b" fill="var(--negative)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Planzeilen" subtitle={`${rows.length} Einträge`}>
          <div className="mb-4 flex flex-wrap gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag suchen…" className="min-w-60 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none" />
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {["alle", "umsatz", "kosten", "ba"].map((a) => (
                <button key={a} onClick={() => setFilter(a)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === a ? "bg-card shadow-card" : "text-muted-foreground"}`}>{a === "alle" ? "Alle" : ARTEN[a]}</button>
              ))}
            </div>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-medium">Auftrag</th>
                  <th className="pb-3 font-medium">Region</th>
                  <th className="pb-3 font-medium">Art</th>
                  <th className="pb-3 font-medium">Monat</th>
                  <th className="pb-3 text-right font-medium">Wert gespeichert</th>
                  <th className="pb-3 text-right font-medium">Angezeigt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <tr key={`${e.nr}-${e.groesse}-${e.monat}-${i}`} className="border-t border-border">
                    <td className="py-2.5"><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.nr}</p></td>
                    <td className="text-muted-foreground">{e.region}</td>
                    <td>{ARTEN[e.groesse] ?? e.groesse}{e.art !== "plan" ? ` · ${e.art}` : ""}</td>
                    <td>{dash.monate[e.monat - 1]}</td>
                    <td className="text-right">{eur(e.wert)}</td>
                    <td className="text-right font-semibold">{eur(e.groesse === "umsatz" ? -e.wert : e.wert)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}
