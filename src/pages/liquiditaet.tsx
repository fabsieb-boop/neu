import { Link } from "react-router-dom";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { useDash } from "@/data";
import { DataTable, money, eur, Panel, PageHeader, Kpi, ChartTip, axis } from "@/components/dash";

const monatLabel = (value: string) => {
  const [year, month] = value.split("-");
  const names = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${names[Number(month) - 1] ?? month} ${year}`;
};

export function Liquiditaet() {
  const { dash, user } = useDash();
  const { start, dso, dpo, weeks } = dash.liquidity;
  const konto = dash.konto[0];
  const min = Math.min(...weeks.map((w) => w.bestand));
  const ende = weeks.at(-1)?.bestand ?? 0;
  const chart = weeks.map((w) => ({ ...w, label: w.datum.slice(8) + "." + w.datum.slice(5, 7), ausAnzeige: -w.aus }));
  const maxSaldo = Math.max(...dash.liqBestand.map((r) => Math.abs(r.saldo)), 1);
  return (
    <div>
      <PageHeader title="Liquiditätsplan" subtitle={`26 Wochen ab Montag der Stichtagswoche · DSO ${dso} / DPO ${dpo} Tage`} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Startbestand" value={start} hint="letzter Cash-Pool" signed icon />
          <Kpi label="Tiefster Stand" value={min} hint="innerhalb 26 Wochen" signed />
          <Kpi label="Endbestand" value={ende} hint="nach 26 Wochen" signed />
          {konto && <Kpi label="Kontostand" value={konto.saldo} hint={`${konto.konto} · ${konto.stichtag.split("-").reverse().join(".")}`} icon />}
        </section>
        <Panel title="Einzahlung, Auszahlung und Bestand">
          <div className="h-96">
            <ResponsiveContainer>
              <ComposedChart data={chart}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={2} />
                <YAxis tickFormatter={(v) => eur(v, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--muted)" }} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Area dataKey="bestand" name="Bestand" stroke="var(--chart-1)" strokeWidth={2.5} fill="var(--chart-1)" fillOpacity={0.12} />
                <Bar dataKey="ein" name="Einzahlung" fill="var(--positive)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ausAnzeige" name="Auszahlung" fill="var(--negative)" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Wochenplan">
          <DataTable rows={weeks} cols={[
            { key: "d", label: "Woche ab", render: (r) => r.datum.split("-").reverse().join(".") },
            { key: "e", label: "Einzahlung", right: true, render: (r) => money(r.ein) },
            { key: "a", label: "Auszahlung", right: true, render: (r) => money(r.aus) },
            { key: "n", label: "Netto", right: true, render: (r) => money(r.netto) },
            { key: "b", label: "Bestand", right: true, render: (r) => <span className="font-semibold">{money(r.bestand)}</span> },
          ]} />
        </Panel>
        <Panel title="Kontoauszüge" subtitle={dash.bank.anzahl ? `${dash.bank.anzahl.toLocaleString("de-DE")} Buchungen` : "noch keine Bankdatei"}>
          {dash.bank.anzahl === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Bankbewegungen importiert. CSV, CAMT und MT940 werden unter Import gelesen; schon vorhandene Buchungen werden beim erneuten Einspielen übersprungen.</p>
          ) : (
            <div className="space-y-6">
              <DataTable rows={dash.bank.monate} cols={[
                { key: "m", label: "Monat", render: (row) => monatLabel(row.monat) },
                { key: "e", label: "Eingang", right: true, render: (row) => money(row.ein) },
                { key: "a", label: "Ausgang", right: true, render: (row) => money(row.aus) },
                { key: "n", label: "Buchungen", right: true, render: (row) => row.anzahl.toLocaleString("de-DE") },
              ]} />
              <DataTable rows={dash.bank.bewegungen} cols={[
                { key: "d", label: "Buchungstag", render: (row) => row.datum.split("-").reverse().join(".") },
                { key: "g", label: "Gegenpartei", render: (row) => row.gegenpartei || "–" },
                { key: "t", label: "Text", render: (row) => row.zweck || row.text },
                { key: "b", label: "Betrag", right: true, render: (row) => money(row.betrag) },
              ]} />
            </div>
          )}
          {user.istAdmin && <Link className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" to="/import">Kontoauszug importieren</Link>}
        </Panel>
        <Panel title="Cash-Pool" subtitle={dash.liqBestand[0]?.quelle}>
          <DataTable rows={dash.liqBestand} cols={[
            { key: "m", label: "Monat", render: (r) => dash.monate[r.monat - 1] ?? String(r.monat) },
            { key: "s", label: "Saldo", right: true, render: (r) => money(r.saldo) },
            { key: "b", label: "", render: (r) => <div className="h-2 w-48 rounded-full bg-muted"><div className={`h-2 rounded-full ${r.saldo < 0 ? "bg-negative" : "bg-positive"}`} style={{ width: `${(Math.abs(r.saldo) / maxSaldo) * 100}%` }} /></div> },
          ]} />
        </Panel>
      </main>
    </div>
  );
}
