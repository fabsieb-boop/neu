import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDash } from "@/data";
import { eur, num, Panel, PageHeader, Kpi, axis } from "@/components/dash";
import type { ForecastOrder } from "@/types";

const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
type Zeitraum = "jahr" | "ist" | "plan";

export function ForecastRegionen() {
  const { dash } = useDash();
  const istBis = dash.letzterIst;
  const bekannte = dash.regions.map((r) => r.region);
  const weitere = Array.from(new Set(dash.forecastOrders.map((o) => o.region).filter((r) => r && !bekannte.includes(r))));
  const regions = [...bekannte, ...weitere];
  const [aktiv, setAktiv] = useState<string[]>(regions);
  const [nurAktuell, setNurAktuell] = useState(false);
  const [nurPlan, setNurPlan] = useState(false);
  const [zeit, setZeit] = useState<Zeitraum>("jahr");
  const [q, setQ] = useState("");
  const [zu, setZu] = useState<string[]>([]);
  const cols = zeit === "ist" ? MON.slice(0, istBis).map((_, i) => i) : zeit === "plan" ? MON.map((_, i) => i).filter((i) => i >= istBis) : MON.map((_, i) => i);

  const orders = useMemo(() => dash.forecastOrders.filter((o) =>
    aktiv.includes(o.region) &&
    (!nurAktuell || o.status === "LAUFEND") &&
    (!nurPlan || o.monate.slice(istBis).some((v) => v !== 0)) &&
    `${o.nr} ${o.name}`.toLowerCase().includes(q.toLowerCase()),
  ), [aktiv, dash.forecastOrders, istBis, nurAktuell, nurPlan, q]);

  const byRegion = regions.filter((r) => aktiv.includes(r)).map((r) => {
    const list = orders.filter((o) => o.region === r).sort((a, b) => b.monate.reduce((x, y) => x + y, 0) - a.monate.reduce((x, y) => x + y, 0));
    const sum = MON.map((_, i) => list.reduce((s, o) => s + (o.monate[i] ?? 0), 0));
    return { r, list, sum };
  });
  const chart = MON.map((m, i) => Object.fromEntries([["m", m], ...byRegion.map((g) => [g.r, g.sum[i]])]));
  const tot = (from: number, to: number) => orders.reduce((s, o) => s + o.monate.slice(from, to).reduce((a, b) => a + b, 0), 0);
  const toggle = (r: string) => setAktiv((a) => (a.includes(r) ? a.filter((x) => x !== r) : [...a, r]));
  const hinweis = (order: ForecastOrder, index: number) => {
    if (order.status !== "OHNE STAMM") return undefined;
    const leistung = order.leistungMonate[index] ?? 0;
    const kosten = order.kostenMonate[index] ?? 0;
    if (leistung === 0 && kosten === 0) return undefined;
    return `Journal-Ergebnis: Leistung ${num(leistung, 2)} €, Kosten ${num(kosten, 2)} €`;
  };
  const cell = (order: ForecastOrder, index: number) => {
    const value = order.monate[index] ?? 0;
    const gebucht = order.istMonate[index] ?? 0;
    return (
      <td key={index} title={hinweis(order, index)} className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${index >= istBis ? "bg-plan/15" : ""} ${value === 0 && gebucht === 0 ? "text-muted-foreground/40" : ""} ${value < 0 ? "text-negative" : ""}`}>
        <span className="block">{value === 0 ? "–" : num(value / 1000)}</span>
        {index === istBis && <span className={`block text-[10px] ${gebucht < 0 ? "text-negative" : "text-muted-foreground"}`}>Ist {gebucht === 0 ? "–" : num(gebucht / 1000)}</span>}
      </td>
    );
  };

  return (
    <div>
      <PageHeader title="Forecast je Region" subtitle={dash.aktuellerMonatName ? `Bis ${dash.letzterIstName} steht das Journal. ${dash.aktuellerMonatName} zeigt in jeder Zelle den Plan und darunter das gebuchte Ist.` : `Bis ${dash.letzterIstName} steht das Journal.`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label={`Ist Jan–${dash.letzterIstName.slice(0, 3)}`} value={tot(0, istBis)} hint={`${orders.length} Aufträge im Filter`} />
          <Kpi label="Forecast danach" value={tot(istBis, 12)} hint="Planmonate" />
          <Kpi label="Jahr gesamt" value={tot(0, 12)} hint="Ist + Forecast" />
        </section>
        <div className="sticky top-0 z-10 -mx-6 border-b border-border bg-background/90 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag in der Tabelle suchen…" className="w-full bg-transparent outline-none" />
            </label>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {regions.map((r, i) => (
                <button key={r} onClick={() => toggle(r)} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${aktiv.includes(r) ? "bg-card shadow-card" : "text-muted-foreground opacity-60"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: C[i % 4] }} />{r}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {([["jahr", "Jan–Dez"], ["ist", "Ist"], ["plan", "Forecast"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setZeit(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${zeit === k ? "bg-card shadow-card" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            <Switch on={nurAktuell} set={setNurAktuell} label="Nur aktive" />
            <Switch on={nurPlan} set={setNurPlan} label="Nur mit Plan" />
          </div>
        </div>
        <Panel title="Verlauf je Region">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(v: number) => eur(v)} cursor={{ fill: "var(--muted)" }} />
                <Legend iconType="circle" />
                {byRegion.map((g) => <Bar key={g.r} dataKey={g.r} stackId="a" fill={C[regions.indexOf(g.r) % 4]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Aufträge je Monat" subtitle={`Werte in Tsd. €. ${dash.aktuellerMonatName ?? "Der laufende Monat"} zeigt den Plan und darunter die gebuchte Leistung.`}>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-card">
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="sticky left-0 bg-card pb-3 text-left font-medium">Auftrag</th>
                  {cols.map((i) => <th key={i} className={`px-2 pb-3 text-right font-medium ${i >= istBis ? "text-primary" : ""}`}>{MON[i]}{i === istBis ? <span className="ml-1 text-[9px]">Plan+Ist</span> : i > istBis ? <span className="ml-1 text-[9px]">FC</span> : null}</th>)}
                  <th className="px-2 pb-3 text-right font-medium">Summe</th>
                </tr>
              </thead>
              <tbody>
                {byRegion.map((g) => {
                  const closed = zu.includes(g.r);
                  return (
                    <Fragment key={g.r}>
                      <tr className="cursor-pointer border-t-2 border-border bg-muted font-semibold" onClick={() => setZu((z) => (closed ? z.filter((x) => x !== g.r) : [...z, g.r]))}>
                        <td className="sticky left-0 bg-muted py-2.5 pl-2">
                          <span className="flex items-center gap-2"><ChevronDown className={`h-4 w-4 transition ${closed ? "-rotate-90" : ""}`} />{g.r}<span className="text-xs font-normal text-muted-foreground">({g.list.length})</span></span>
                        </td>
                        {cols.map((i) => {
                          const gebucht = g.list.reduce((s, o) => s + (o.istMonate[i] ?? 0), 0);
                          return (
                            <td key={i} className="whitespace-nowrap px-2 text-right">
                              <span className="block">{num((g.sum[i] ?? 0) / 1000)}</span>
                              {i === istBis && <span className="block text-[10px] font-normal text-muted-foreground">Ist {num(gebucht / 1000)}</span>}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-2 text-right">{num(cols.reduce((s, i) => s + (g.sum[i] ?? 0), 0) / 1000)}</td>
                      </tr>
                      {!closed && g.list.map((o) => (
                        <tr key={o.nr} className="border-t border-border hover:bg-muted/50">
                          <td className="sticky left-0 min-w-60 max-w-72 bg-card py-2 pl-8 pr-4">
                            <Link to={`/auftrag?nr=${encodeURIComponent(o.nr)}`} className="block truncate font-medium hover:underline">{o.name || o.nr}</Link>
                            <p className="text-xs text-muted-foreground">{o.nr}{o.status ? ` · ${o.status}` : ""}{o.psp ? ` · PSP ${o.psp}` : ""}</p>
                          </td>
                          {cols.map((i) => cell(o, i))}
                          <td className="whitespace-nowrap px-2 text-right font-semibold">{num(cols.reduce((s, i) => s + (o.monate[i] ?? 0), 0) / 1000)}</td>
                        </tr>
                      ))}
                    </Fragment>
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

function Switch({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => set(!on)} className="flex items-center gap-2 text-sm font-medium" role="switch" aria-checked={on}>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-accent" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-card transition ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}
