import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useDash } from "@/data";
import { eur, short, Kpi, Panel, ChartTip, PageHeader } from "@/components/dash";

const GUV_ZEILEN = ["Summe Umsatzerlöse", "Rohertrag", "Personalaufwand", "Sachkosten", "EBITDA (Operatives Ergebnis)", "Neutrales Ergebnis", "EBITDA", "Abschreibungen", "Finanzergebnis", "Ergebnis vor Steuern"];

export function Uebersicht() {
  const { dash } = useDash();
  const months = dash.months;
  const ist = months.filter((m) => m.ist);
  const leistungIst = ist.reduce((s, m) => s + m.leistung, 0);
  const ebitdaIst = ist.reduce((s, m) => s + m.ebitda, 0);
  const ebitdaJahr = months.reduce((s, m) => s + m.ebitda, 0);
  const orderErg = dash.orders.reduce((s, o) => s + o.akte, 0);
  const orderLeist = dash.orders.reduce((s, o) => s + o.leistung, 0);
  const ende = dash.liquidity.weeks.at(-1)?.bestand ?? 0;

  return (
    <div>
      <PageHeader title="Übersicht" subtitle={`Geschäftsjahr ${dash.jahr}, Ist bis ${dash.letzterIstName}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi label="Gesamtleistung Ist" value={leistungIst} hint={`Monate bis ${dash.letzterIstName}`} />
          <Kpi label="EBITDA Ist" value={ebitdaIst} hint="Operativ plus neutral" signed />
          <Kpi label="EBITDA Jahr" value={ebitdaJahr} hint="Danach der Plan" signed />
          <Kpi label="Leistung Aufträge" value={orderLeist} hint="Erlöse plus Bestand" />
          <Kpi label="Ergebnis Aufträge" value={orderErg} hint="Ohne Belegart CA" signed />
          <Kpi label="Bestand 26 Wochen" value={ende} hint="Cash-Pool plus Zahlungsplan" signed icon />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Gesamtleistung und EBITDA je Monat" className="lg:col-span-2">
            <div className="h-80">
              <ResponsiveContainer>
                <ComposedChart data={months} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tickFormatter={short} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => eur(v, true)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)" }} />
                  <ReferenceLine y={0} stroke="var(--border)" />
                  <Bar dataKey="leistung" name="Gesamtleistung" radius={[6, 6, 0, 0]}>
                    {months.map((m) => <Cell key={m.m} fill={m.ist ? "var(--chart-1)" : "var(--plan)"} />)}
                  </Bar>
                  <Line dataKey="ebitda" name="EBITDA" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-2)" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Ergebnis je Region" subtitle="Jahr Akte">
            <div className="space-y-4">
              {dash.regions.map((r) => ({ ...r, total: r.akte.reduce((a, b) => a + b, 0), fc: r.forecast.reduce<number>((a, b) => a + (b ?? 0), 0) }))
                .sort((a, b) => b.total - a.total)
                .map((r, _, arr) => {
                  const max = Math.max(...arr.map((x) => Math.abs(x.total)), 1);
                  return (
                    <div key={r.region}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{r.region}</span>
                        <span className={r.total < 0 ? "text-negative" : ""}>{eur(r.total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className={`h-2 rounded-full ${r.total < 0 ? "bg-negative" : "bg-positive"}`} style={{ width: `${(Math.abs(r.total) / max) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Forecast-Umsatz Plan: {eur(r.fc)}</p>
                    </div>
                  );
                })}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Panel title="Monatsübersicht" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 font-medium">Monat</th>
                    <th className="pb-3 text-right font-medium">Umsatz</th>
                    <th className="pb-3 text-right font-medium">Bestand</th>
                    <th className="pb-3 text-right font-medium">Gesamtleistung</th>
                    <th className="pb-3 text-right font-medium">EBITDA</th>
                    <th className="pb-3 text-right font-medium">Ergebnis Akte</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.m} className="border-t border-border">
                      <td className="py-2.5">
                        <span className="font-medium">{m.name}</span>
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${m.ist ? "bg-secondary text-secondary-foreground" : "bg-plan/30 text-primary"}`}>{m.ist ? "Ist" : "Plan"}</span>
                      </td>
                      <td className="text-right">{eur(m.umsatz)}</td>
                      <td className="text-right text-muted-foreground">{eur(m.bestand)}</td>
                      <td className="text-right font-medium">{eur(m.leistung)}</td>
                      <td className={`text-right font-semibold ${m.ebitda < 0 ? "text-negative" : "text-positive"}`}>{eur(m.ebitda)}</td>
                      <td className={`text-right ${m.auftragsergebnis < 0 ? "text-negative" : ""}`}>{eur(m.auftragsergebnis)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title={`GuV Januar–${dash.letzterIstName}`} subtitle="Zwischensummen">
            <ul className="divide-y divide-border text-sm">
              {dash.guv.filter((g) => g.sum && GUV_ZEILEN.includes(g.name)).map((g) => {
                const t = g.values.reduce((a, b) => a + b, 0);
                const key = g.name === "EBITDA" || g.name === "Ergebnis vor Steuern";
                return (
                  <li key={g.name} className={`flex justify-between py-2 ${key ? "font-semibold" : ""}`}>
                    <span className={key ? "" : "text-muted-foreground"}>{g.name}</span>
                    <span className={t < 0 ? "text-negative" : ""}>{eur(t)}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>

        <Panel title="Verlustbewertungen" icon={<AlertTriangle className="h-4 w-4 text-accent" />}>
          <ul className="grid gap-3 md:grid-cols-2">
            {dash.verluste.map((v, i) => (
              <li key={i} className="flex items-start justify-between gap-4 rounded-lg bg-muted p-3 text-sm">
                <div>
                  <p className="font-medium">{v.notiz}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(v.monat).padStart(2, "0")}/{v.jahr} · {v.gebucht ? "gebucht" : "offen"} · {v.imForecast ? "im Forecast" : "nicht im Forecast"}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-negative">{eur(v.betrag)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  );
}

export function RegionaleUebersicht() {
  const { dash, user } = useDash();
  const rows = dash.regionalMonths;
  const ist = rows.filter((row) => row.ist);
  const leistung = ist.reduce((sum, row) => sum + row.leistung, 0);
  const ergebnis = ist.reduce((sum, row) => sum + row.ergebnis, 0);
  const forecast = dash.forecast
    .filter((row) => !row.ist)
    .reduce((sum, row) => sum + row.angezeigt, 0);
  const series = rows.map((row) => ({ ...row, kurz: short(row.name) }));

  return (
    <div>
      <PageHeader title="Meine Übersicht" subtitle={`Regionen: ${user.regionen.join(", ")}`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Leistung Ist" value={leistung} hint={`Januar–${dash.letzterIstName}`} />
          <Kpi label="Ergebnis Akte Ist" value={ergebnis} hint="nur zugeordnete Regionen" signed />
          <Kpi label="Forecast danach" value={forecast} hint="Umsatz + Bestand − Kosten" signed />
          <Kpi label="Aufträge" value={dash.orders.length} hint={`${dash.scope.regions.length} Regionen`} plain />
        </section>
        <Panel title="Leistung und Ergebnis je Monat" subtitle="ausschließlich zugeordnete Regionen">
          <div className="h-80">
            <ResponsiveContainer>
              <ComposedChart data={series} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="kurz" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => eur(value, true)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)" }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="leistung" name="Leistung" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Line dataKey="ergebnis" name="Ergebnis Akte" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Monatsübersicht" subtitle="aus den regional gefilterten Buchungen">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 font-medium">Monat</th>
                  <th className="pb-3 text-right font-medium">Umsatz</th>
                  <th className="pb-3 text-right font-medium">Bestand</th>
                  <th className="pb-3 text-right font-medium">Leistung</th>
                  <th className="pb-3 text-right font-medium">Ergebnis Akte</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.m} className="border-t border-border">
                    <td className="py-2.5 font-medium">{row.name}</td>
                    <td className="text-right">{eur(row.umsatz)}</td>
                    <td className="text-right">{eur(row.bestand)}</td>
                    <td className="text-right font-semibold">{eur(row.leistung)}</td>
                    <td className={`text-right font-semibold ${row.ergebnis < 0 ? "text-negative" : "text-positive"}`}>{eur(row.ergebnis)}</td>
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
