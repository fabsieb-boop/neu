import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Legend } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, axis, short } from "@/components/dash";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function Regionen() {
  const { dash } = useDash();
  const mon = dash.monate.map((m) => short(m));
  const series = mon.map((m, i) => Object.fromEntries([["m", m], ...dash.regions.map((r) => [r.region, r.akte[i]])]));
  const max = Math.max(...dash.regions.flatMap((r) => r.akte.map(Math.abs)), 1);
  return (
    <div>
      <PageHeader title="Regionen" subtitle="Ergebnis Akte je Region" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dash.regions.map((r, i) => {
            const t = r.akte.reduce((a, b) => a + b, 0);
            const fc = r.forecast.reduce<number>((a, b) => a + (b ?? 0), 0);
            return (
              <div key={r.region} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{r.region}</p>
                </div>
                <p className={`mt-3 font-display text-2xl font-semibold ${t < 0 ? "text-negative" : ""}`}>{eur(t, true)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Forecast-Umsatz Plan {eur(fc, true)}</p>
              </div>
            );
          })}
        </section>
        <Panel title="Verlauf je Monat">
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={series}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => eur(v)} />
                <Legend iconType="circle" />
                <ReferenceLine y={0} stroke="var(--border)" />
                {dash.regions.map((r, i) => <Line key={r.region} type="monotone" dataKey={r.region} stroke={COLORS[i]} strokeWidth={2.5} dot={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Heatmap" subtitle="grün = Gewinn, rot = Verlust">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead><tr><th />{mon.map((m) => <th key={m} className="font-medium text-muted-foreground">{m}</th>)}</tr></thead>
              <tbody>
                {dash.regions.map((r) => (
                  <tr key={r.region}>
                    <td className="pr-3 text-sm font-medium">{r.region}</td>
                    {r.akte.map((v, i) => (
                      <td key={i} className="relative h-12 min-w-16 overflow-hidden rounded-md bg-muted text-center">
                        <span className={`absolute inset-0 ${v < 0 ? "bg-negative" : "bg-positive"}`} style={{ opacity: 0.15 + (Math.abs(v) / max) * 0.7 }} />
                        <span className="relative font-semibold">{eur(v, true)}</span>
                      </td>
                    ))}
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
