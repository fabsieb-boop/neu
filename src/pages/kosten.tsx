import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, Kpi, axis, DataTable, money } from "@/components/dash";

export function Kosten() {
  const { dash } = useDash();
  const [q, setQ] = useState("");
  const rows = useMemo(() => dash.kostenverfolgung.filter((r) => `${r.nr} ${r.titel} ${r.region} ${r.psp}`.toLowerCase().includes(q.toLowerCase())), [dash.kostenverfolgung, q]);
  const top = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15);
  const meldung = rows.reduce((s, r) => s + r.ergebnisMeldung, 0);
  const sap = rows.reduce((s, r) => s + r.ergebnisSap, 0);
  return (
    <div>
      <PageHeader title="Kostenverfolgung" subtitle="Meldung der Region gegen die Akte" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Ergebnis Meldung" value={meldung} hint="eingegebener Wert" signed />
          <Kpi label="Ergebnis SAP" value={sap} hint="Ergebnis Akte" signed />
          <Kpi label="Abweichung" value={sap - meldung} hint="SAP − Meldung" signed />
        </section>
        <Panel title="Größte Abweichungen" subtitle="15 Aufträge nach Betrag der Differenz">
          <div className="h-96">
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nr" width={120} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => eur(v)} cursor={{ fill: "var(--muted)" }} />
                <ReferenceLine x={0} stroke="var(--border)" />
                <Bar dataKey="delta" name="Abweichung" radius={4}>
                  {top.map((r, i) => <Cell key={i} fill={r.delta < 0 ? "var(--negative)" : "var(--positive)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Alle Meldungen" subtitle={`${rows.length} Zeilen`}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag, Titel, Region…" className="mb-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none" />
          <DataTable rows={rows} max={640} cols={[
            { key: "t", label: "Auftrag", render: (r) => <><p className="font-medium">{r.titel}</p><p className="text-xs text-muted-foreground">{r.nr} · {r.region}</p></> },
            { key: "um", label: "Umsatz Meldung", right: true, render: (r) => eur(r.umsatzMeldung) },
            { key: "us", label: "Umsatz SAP", right: true, render: (r) => eur(r.umsatzSap) },
            { key: "em", label: "Ergebnis Meldung", right: true, render: (r) => money(r.ergebnisMeldung) },
            { key: "es", label: "Ergebnis SAP", right: true, render: (r) => money(r.ergebnisSap) },
            { key: "d", label: "Delta", right: true, render: (r) => <span className="font-semibold">{money(r.delta)}</span> },
            { key: "v", label: "Vertrag", right: true, render: (r) => eur(r.vertrag) },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
