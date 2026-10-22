import { Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useDash } from "@/data";
import { DataTable, money, eur, Panel, PageHeader, Kpi, ChartTip, axis, short } from "@/components/dash";

export function Ebitda() {
  const { dash } = useDash();
  let c = 0;
  const rows = dash.months.map((m) => ({ ...m, kurz: short(m.name), kum: (c += m.ebitda), marge: m.leistung ? (m.ebitda / m.leistung) * 100 : null }));
  const best = [...rows].sort((a, b) => b.ebitda - a.ebitda)[0];
  const worst = [...rows].sort((a, b) => a.ebitda - b.ebitda)[0];
  return (
    <div>
      <PageHeader title="EBITDA" subtitle={`Journal der GuV bis ${dash.letzterIstName}, danach Plan`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Kpi label="EBITDA Jahr" value={c} hint="Ist + Plan" signed />
          <Kpi label={`Bester Monat · ${best.name}`} value={best.ebitda} hint="höchstes EBITDA" signed />
          <Kpi label={`Schwächster Monat · ${worst.name}`} value={worst.ebitda} hint="niedrigstes EBITDA" signed />
        </section>
        <Panel title="EBITDA je Monat">
          <div className="h-80">
            <ResponsiveContainer>
              <ComposedChart data={rows}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="kurz" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)" }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="ebitda" name="EBITDA" radius={6}>
                  {rows.map((r) => <Cell key={r.m} fill={r.ebitda < 0 ? "var(--negative)" : r.ist ? "var(--positive)" : "var(--plan)"} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="EBITDA-Plan" subtitle="Operativ + Overhead + offene Verlustbewertung">
          <DataTable rows={rows} cols={[
            { key: "m", label: "Monat", render: (r) => r.name },
            { key: "o", label: "Operativ", right: true, render: (r) => money(r.operativ) },
            { key: "h", label: "Overhead", right: true, render: (r) => money(r.overhead) },
            { key: "b", label: "Bewertung Plan", right: true, render: (r) => money(r.bewertungPlan) },
            { key: "f", label: "Bewertung offen", right: true, render: (r) => money(r.bewertungOffen) },
            { key: "s", label: "Angezeigt", right: true, render: (r) => <span className="font-semibold">{money(r.ebitda)}</span> },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
