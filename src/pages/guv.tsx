import { useEffect } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useDash } from "@/data";
import { eur, Panel, PageHeader, axis } from "@/components/dash";
import { buildGuvWaterfall } from "@/lib/guv-waterfall";

export function GuV() {
  const { dash } = useDash();
  const mon = dash.monate.slice(0, 9).map((m) => m.slice(0, 3));
  const tot = (n: string) => dash.guv.find((g) => g.name === n)?.values.reduce((a, b) => a + b, 0) ?? 0;
  const { steps, run, wf } = buildGuvWaterfall(dash.guv);

  // #region agent log
  useEffect(() => {
    void fetch("/api/debug/guv-render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: Object.fromEntries(steps),
        terminal: run,
        ebitda: tot("EBITDA"),
        resultBeforeTax: tot("Ergebnis vor Steuern"),
      }),
    }).catch(() => undefined);
  }, [dash.guv]);
  // #endregion

  return (
    <div>
      <PageHeader title="Gewinn- und Verlustrechnung" subtitle={`Januar bis ${dash.letzterIstName}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Panel title="Vom Umsatz zum EBITDA" subtitle={`Wasserfall Jan–${mon.at(-1)}`}>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={wf}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number, n) => (n === "base" ? "" : eur(v))} cursor={{ fill: "var(--muted)" }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="base" stackId="a" fill="transparent" />
                <Bar dataKey="val" stackId="a" name="Betrag" radius={[4, 4, 0, 0]}>
                  {wf.map((w, i) => <Cell key={i} fill={i === 0 || i === wf.length - 1 ? "var(--chart-1)" : w.neg ? "var(--negative)" : "var(--positive)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Alle Positionen">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-medium">Position</th>
                  {mon.map((m) => <th key={m} className="pb-3 text-right font-medium">{m}</th>)}
                  <th className="pb-3 text-right font-medium">Summe</th>
                </tr>
              </thead>
              <tbody>
                {dash.guv.map((g) => {
                  const t = g.values.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={g.zeile} className={`border-t border-border ${g.sum ? "bg-muted font-semibold" : ""}`}>
                      <td className="whitespace-nowrap py-2 pl-2 pr-4">{g.name}</td>
                      {g.values.map((v, j) => <td key={j} className={`whitespace-nowrap px-2 text-right ${v < 0 ? "text-negative" : ""}`}>{eur(v, true)}</td>)}
                      <td className={`whitespace-nowrap pl-2 pr-2 text-right ${t < 0 ? "text-negative" : ""}`}>{eur(t, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}
