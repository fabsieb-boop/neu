import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, Kpi, ChartTip, axis, short } from "@/components/dash";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function Forecast() {
  const { dash } = useDash();
  let c = 0;
  const rows = dash.forecast.map((m) => {
    c += m.angezeigt;
    return { ...m, kurz: short(m.name), istKum: m.ist ? c : null, planKum: m.m >= dash.letzterIst ? c : null };
  });
  const q4 = dash.regions.map((r) => ({ name: r.region, value: r.forecast.reduce<number>((a, b) => a + (b ?? 0), 0) }));
  const q4sum = q4.reduce((a, b) => a + b.value, 0);
  const istSumme = dash.forecast.filter((m) => m.ist).reduce((s, m) => s + m.angezeigt, 0);
  return (
    <div>
      <PageHeader title="Forecast" subtitle="Hochrechnung bis Dezember" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Leistung Ist" value={istSumme} hint={`Januar–${dash.letzterIstName}, Projekte`} />
          <Kpi label="Hochrechnung Jahr" value={c} hint="Ist + Plan" />
          <Kpi label="Forecast-Umsatz Plan" value={q4sum} hint="alle Regionen, ab dem ersten Planmonat" />
        </section>
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Angezeigte Leistung kumuliert" className="lg:col-span-2" subtitle="Ist aus dem Journal, Plan aus Forecast_Plan">
            <div className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={rows}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="kurz" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTip />} />
                  <Area dataKey="istKum" name="Ist kumuliert" stroke="var(--chart-1)" strokeWidth={2.5} fill="var(--chart-1)" fillOpacity={0.15} />
                  <Line dataKey="planKum" name="Plan kumuliert" stroke="var(--chart-2)" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Plan-Umsatz nach Region">
            <div className="relative h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={q4} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
                    {q4.map((_, i) => <Cell key={i} fill={COLORS[i % 4]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => eur(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="font-display text-xl font-semibold">{eur(q4sum, true)}</p>
                  <p className="text-xs text-muted-foreground">Plan gesamt</p>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {q4.map((r, i) => (
                <li key={r.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % 4] }} />{r.name}</span>
                  <span className="font-medium">{eur(r.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}
