import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { OrderSearch } from "@/components/order-search";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, Kpi, axis, DataTable, money, short } from "@/components/dash";

export function Auftrag() {
  const { dash, journal } = useDash();
  const [nr, setNr] = useState(dash.auftragsnummer);
  const o = dash.orders.find((x) => x.nr === nr);
  const d = dash.auftragDetail[nr];
  const belege = journal.filter((j) => j.nr === nr);
  const pie = d ? [{ n: "Variable Kosten", v: d.kvar }, { n: "Fixe Kosten", v: d.kfix }, { n: "Gemeinkosten", v: d.umlage }] : [];
  const C = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)"];
  return (
    <div>
      <PageHeader title={o?.name || nr} subtitle={`${nr}${o ? ` · ${o.region}` : ""}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="max-w-xl"><OrderSearch value={nr} onSelect={setNr} /></div>
        {d && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Leistung" value={d.leistung} hint="Umsatzerlöse + Bestand" />
              <Kpi label="DB1" value={d.db1} hint="Leistung − variable Kosten" signed />
              <Kpi label="DB2" value={d.db2} hint="DB1 − fixe Kosten" signed />
              <Kpi label="Ergebnis Akte" value={d.akte} hint={d.leistung ? `Marge ${((d.akte / d.leistung) * 100).toFixed(1)} %` : "ohne Leistung"} signed />
            </section>
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="Verlauf je Monat" className="lg:col-span-2" subtitle={`${d.belege} Belege mit dieser Projektnummer`}>
                <div className="h-72">
                  <ResponsiveContainer>
                    <ComposedChart data={d.monate.map((m) => ({ ...m, kurz: short(m.name) }))}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="kurz" tick={axis} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(v: number) => eur(v)} cursor={{ fill: "var(--muted)" }} />
                      <Bar dataKey="leistung" name="Leistung" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="kosten" name="Kosten" fill="var(--plan)" radius={[4, 4, 0, 0]} />
                      <Line dataKey="ergebnis" name="Ergebnis" stroke="var(--chart-2)" strokeWidth={2.5} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Kostenstruktur">
                <div className="h-48">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pie} dataKey="v" nameKey="n" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                        {pie.map((_, i) => <Cell key={i} fill={C[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => eur(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {pie.map((p, i) => <li key={p.n} className="flex justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C[i] }} />{p.n}</span><span className="font-medium">{eur(p.v)}</span></li>)}
                </ul>
              </Panel>
            </div>
          </>
        )}
        <Panel title="Belege" subtitle={`${belege.length} Buchungen im Geschäftsjahr`}>
          <DataTable rows={belege} cols={[
            { key: "d", label: "Datum", render: (r) => r.datum.split("-").reverse().join(".") },
            { key: "b", label: "Beleg", render: (r) => `${r.belegart} ${r.beleg}` },
            { key: "k", label: "Kostenart", render: (r) => r.kostenart },
            { key: "t", label: "Text", render: (r) => <span className="text-muted-foreground">{r.text}</span> },
            { key: "w", label: "Wert", right: true, render: (r) => money(r.wert) },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
