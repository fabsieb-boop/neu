import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Printer } from "lucide-react";
import { useDash } from "@/data";
import { axis, DataTable, eur, Kpi, num, PageHeader, Panel, short } from "@/components/dash";
import type { Dash } from "@/types";

type Row = Record<string, string | number | boolean | null>;
type Filter = { spalte: string; op: string; wert: string };
type Calculation = { name: string; formel: string };
type BuilderState = {
  spalten: string[];
  filter: Filter[];
  gruppierung: string[];
  aggregat: "summe" | "anzahl" | "mittel" | "min" | "max";
  rechenspalten: Calculation[];
  grenze: number;
};
type Template = { id: number; name: string; quelle: string; aufbau: BuilderState; geaendertAt: string };

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function downloadCsv(name: string, rows: Row[], columns = rows.length ? Object.keys(rows[0]) : []) {
  const content = [
    columns.map(csvCell).join(";"),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(";")),
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

const reportButton = "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted";

export function ManagementBericht() {
  const { dash } = useDash();
  const [monat, setMonat] = useState(dash.letzterIst);
  const current = dash.months[monat - 1];
  const bis = dash.months.slice(0, monat);
  const year = dash.months;
  const glBis = bis.reduce((sum, row) => sum + row.leistung, 0);
  const ebitdaBis = bis.reduce((sum, row) => sum + row.ebitda, 0);
  const ebitdaJahr = year.reduce((sum, row) => sum + row.ebitda, 0);
  const regionRows = dash.regions.map((region) => ({
    Region: region.region,
    "Ergebnis Akte": region.akte.slice(0, monat).reduce((sum, value) => sum + value, 0),
    "Forecast-Umsatz": region.forecast.reduce<number>((sum, value) => sum + (value ?? 0), 0),
  }));

  const exportRows = dash.months.map((row) => ({
    Monat: row.name,
    Art: row.ist ? "Ist" : "Plan",
    Umsatz: row.umsatz,
    Bestand: row.bestand,
    Gesamtleistung: row.leistung,
    EBITDA: row.ebitda,
    "Ergebnis Akte": row.auftragsergebnis,
  }));

  return (
    <div>
      <PageHeader title="Management-Bericht" subtitle="Monatlich gleiche Struktur, ausschließlich aus der Excel-Datenbasis" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-card print:hidden">
          <label className="text-xs font-medium text-muted-foreground">
            Berichtsmonat
            <select value={monat} onChange={(event) => setMonat(Number(event.target.value))} className="mt-1 block rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
              {dash.monate.map((name, index) => <option key={name} value={index + 1}>{name} {dash.jahr}</option>)}
            </select>
          </label>
          <button className={reportButton} onClick={() => downloadCsv(`TVF_Management-Bericht_${dash.jahr}-${String(monat).padStart(2, "0")}.csv`, exportRows)}><Download className="h-4 w-4" />Excel-Daten</button>
          <button className={reportButton} onClick={() => window.print()}><Printer className="h-4 w-4" />Drucken / PDF</button>
        </div>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label={`Gesamtleistung ${short(current.name)}`} value={current.leistung} hint={current.ist ? "GuV" : "Plan"} />
          <Kpi label={`EBITDA ${short(current.name)}`} value={current.ebitda} hint={current.ist ? "GuV" : "Plan"} signed />
          <Kpi label={`Gesamtleistung Jan–${short(current.name)}`} value={glBis} hint={`${monat} Monate`} />
          <Kpi label={`EBITDA Jan–${short(current.name)}`} value={ebitdaBis} hint="kumuliert" signed />
          <Kpi label="Ist + Forecast" value={ebitdaJahr} hint="EBITDA Jahr" signed />
        </section>
        <Panel title="Auf einen Blick" subtitle={`Berichtsmonat ${current.name} ${dash.jahr}`}>
          <ol className="grid gap-3 text-sm md:grid-cols-2">
            {[
              `Gesamtleistung im Monat: ${eur(current.leistung)}.`,
              `EBITDA im Monat: ${eur(current.ebitda)}.`,
              `Gesamtleistung kumuliert: ${eur(glBis)}.`,
              `EBITDA kumuliert: ${eur(ebitdaBis)}.`,
              `EBITDA aus Ist und Folgeplan: ${eur(ebitdaJahr)}.`,
              `Liquiditätsbestand am Ende der 26-Wochen-Reihe: ${eur(dash.liquidity.weeks.at(-1)?.bestand ?? 0)}.`,
            ].map((text, index) => <li key={text} className="rounded-lg bg-muted p-4"><span className="mr-2 font-semibold text-accent">{index + 1}.</span>{text}</li>)}
          </ol>
        </Panel>
        <Panel title="Monatsverlauf" subtitle="Ist, danach Plan">
          <div className="h-80">
            <ResponsiveContainer>
              <ComposedChart data={dash.months}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tickFormatter={short} tick={axis} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(value) => eur(value, true)} tick={axis} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(value: number) => eur(value)} />
                <Legend />
                <Bar dataKey="leistung" name="Gesamtleistung" fill="var(--chart-1)" />
                <Line dataKey="ebitda" name="EBITDA" stroke="var(--chart-2)" strokeWidth={2.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Regionen kumuliert" subtitle={`Januar–${current.name}`}>
            <DataTable rows={regionRows} cols={[
              { key: "region", label: "Region", render: (row) => row.Region },
              { key: "erg", label: "Ergebnis Akte", right: true, render: (row) => eur(row["Ergebnis Akte"]) },
              { key: "fc", label: "Forecast-Umsatz", right: true, render: (row) => eur(row["Forecast-Umsatz"]) },
            ]} />
          </Panel>
          <Panel title="Datenqualität und Quellen">
            <dl className="divide-y divide-border text-sm">
              {[
                ["GuV und EBITDA", "GuV_Positionen / GuV"],
                ["Forecast", "Auftrag_Journal und Forecast_Plan"],
                ["Regionen", "Projektstamm und Auftrag_Journal"],
                ["Liquidität", "Liq_Monat, Liq_Parameter, Liq_Bestand und Kontostand"],
                ["Kostenverfolgung", "Kostenverfolgung und Auftrag_Journal"],
              ].map(([label, source]) => <div key={label} className="flex justify-between gap-4 py-3"><dt className="font-medium">{label}</dt><dd className="text-right text-muted-foreground">{source}</dd></div>)}
            </dl>
          </Panel>
        </section>
      </main>
    </div>
  );
}

export function Berichte() {
  const [tab, setTab] = useState<"fest" | "kennzahlen" | "baukasten">("fest");
  return (
    <div>
      <PageHeader title="Berichtsgenerator" subtitle="Feste Berichte, Kennzahlen und eigene Auswertungen" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="flex w-fit gap-1 rounded-lg bg-muted p-1 print:hidden">
          {([
            ["fest", "Feste Berichte"],
            ["kennzahlen", "Mein Bericht"],
            ["baukasten", "Baukasten"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-md px-4 py-2 text-sm font-medium ${tab === key ? "bg-card shadow-card" : "text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
        {tab === "fest" && <FixedReports />}
        {tab === "kennzahlen" && <KpiReport />}
        {tab === "baukasten" && <ReportBuilder />}
      </main>
    </div>
  );
}

function FixedReports() {
  const { dash } = useDash();
  const [type, setType] = useState<"forecast" | "liquiditaet" | "rentabilitaet">("forecast");
  const exports = fixedRows(dash, type);
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-card print:hidden">
        <label className="text-xs font-medium text-muted-foreground">
          Bericht
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="mt-1 block min-w-60 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
            <option value="forecast">Forecast-Bericht</option>
            <option value="liquiditaet">Liquiditätsbericht</option>
            <option value="rentabilitaet">Rentabilitätsbericht</option>
          </select>
        </label>
        <button className={reportButton} onClick={() => downloadCsv(`TVF_${type}_${dash.jahr}.csv`, exports)}><Download className="h-4 w-4" />Excel-Daten</button>
        <button className={reportButton} onClick={() => window.print()}><Printer className="h-4 w-4" />Drucken / PDF</button>
      </div>
      {type === "forecast" && <ForecastReport />}
      {type === "liquiditaet" && <LiquidityReport />}
      {type === "rentabilitaet" && <ProfitabilityReport />}
    </>
  );
}

function fixedRows(dash: Dash, type: "forecast" | "liquiditaet" | "rentabilitaet"): Row[] {
  if (type === "forecast") return dash.forecastOrders.map((order) => ({
    Auftrag: order.nr,
    Name: order.name,
    Region: order.region,
    Status: order.status,
    ...Object.fromEntries(dash.monate.map((month, index) => [month, order.monate[index] ?? 0])),
    Gesamt: order.monate.reduce((sum, value) => sum + value, 0),
  }));
  if (type === "liquiditaet") return dash.liquidity.weeks.map((week) => ({
    Datum: week.datum, Einzahlungen: week.ein, Auszahlungen: week.aus, Netto: week.netto, Bestand: week.bestand,
  }));
  return dash.orders.map((order) => ({
    Auftrag: order.nr,
    Name: order.name,
    Region: order.region,
    Leistung: order.leistung,
    "Variable Kosten": order.kvar,
    "Fixe Kosten": order.kfix,
    Umlage: order.umlage,
    "DB I": order.leistung - order.kvar,
    "Ergebnis Akte": order.akte,
    Abgrenzung: order.abgrenzung,
  }));
}

function ForecastReport() {
  const { dash } = useDash();
  const ist = dash.forecast.filter((row) => row.ist).reduce((sum, row) => sum + row.angezeigt, 0);
  const plan = dash.forecast.filter((row) => !row.ist).reduce((sum, row) => sum + row.angezeigt, 0);
  const regions = aggregateRegions(dash);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Leistung Ist" value={ist} hint={`Januar–${dash.letzterIstName}`} />
        <Kpi label="Forecast Rest" value={plan} hint="Planmonate" signed />
        <Kpi label="Jahreserwartung" value={ist + plan} hint="Ist + Forecast" signed />
        <Kpi label="Projekte" value={dash.orders.reduce((sum, order) => sum + Number(order.leistung !== 0), 0)} hint="mit Leistung" plain />
      </section>
      <Panel title="Abrechnungsstand je Projekt" subtitle={`${dash.orders.length} Aufträge`}>
        <DataTable rows={[...dash.orders].sort((a, b) => b.leistung - a.leistung)} cols={[
          { key: "p", label: "Projekt", render: (row) => <><p className="font-medium">{row.name || row.nr}</p><p className="text-xs text-muted-foreground">{row.nr}</p></> },
          { key: "r", label: "Region", render: (row) => row.region },
          { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
          { key: "a", label: "Anteil", right: true, render: (row) => `${num(dash.orders.reduce((sum, item) => sum + item.leistung, 0) ? row.leistung / dash.orders.reduce((sum, item) => sum + item.leistung, 0) * 100 : 0, 1)} %` },
          { key: "d1", label: "DB I", right: true, render: (row) => eur(row.leistung - row.kvar) },
          { key: "e", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
        ]} />
      </Panel>
      <Panel title="Ergebnisrechnung je Region">
        <DataTable rows={regions} cols={[
          { key: "r", label: "Region", render: (row) => row.region },
          { key: "p", label: "Projekte", right: true, render: (row) => row.projekte },
          { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
          { key: "v", label: "var. Kosten", right: true, render: (row) => eur(row.kvar) },
          { key: "d", label: "DB I", right: true, render: (row) => eur(row.leistung - row.kvar) },
          { key: "f", label: "Fix", right: true, render: (row) => eur(row.kfix) },
          { key: "u", label: "Umlage", right: true, render: (row) => eur(row.umlage) },
          { key: "e", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
        ]} />
      </Panel>
    </div>
  );
}

function LiquidityReport() {
  const { dash } = useDash();
  const weeks = dash.liquidity.weeks;
  const lowest = weeks.reduce((candidate, week) => week.bestand < candidate.bestand ? week : candidate, weeks[0]);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Startbestand" value={dash.liquidity.start} hint={dash.stichtag} signed icon />
        <Kpi label="Tiefster Bestand" value={lowest?.bestand ?? 0} hint={lowest?.datum ?? "keine Reihe"} signed />
        <Kpi label="Einzahlungen" value={weeks.reduce((sum, row) => sum + row.ein, 0)} hint={`${weeks.length} Wochen`} />
        <Kpi label="Endbestand" value={weeks.at(-1)?.bestand ?? 0} hint={weeks.at(-1)?.datum ?? "keine Reihe"} signed />
      </section>
      <Panel title="Zahlungsplan nach Kalenderwochen" subtitle={`DSO ${dash.liquidity.dso} Tage · DPO ${dash.liquidity.dpo} Tage`}>
        <DataTable rows={weeks} cols={[
          { key: "d", label: "Wochenbeginn", render: (row) => new Date(`${row.datum}T00:00:00`).toLocaleDateString("de-DE") },
          { key: "e", label: "Einzahlungen", right: true, render: (row) => eur(row.ein) },
          { key: "a", label: "Auszahlungen", right: true, render: (row) => eur(row.aus) },
          { key: "n", label: "Netto", right: true, render: (row) => eur(row.netto) },
          { key: "b", label: "Bestand", right: true, render: (row) => eur(row.bestand) },
        ]} />
      </Panel>
    </div>
  );
}

function ProfitabilityReport() {
  const { dash } = useDash();
  const orders = dash.orders.filter((order) => order.leistung !== 0).map((order) => ({
    ...order,
    db1: order.leistung - order.kvar,
    db1Marge: (order.leistung - order.kvar) / order.leistung * 100,
    akteMarge: order.akte / order.leistung * 100,
  }));
  const leistung = orders.reduce((sum, row) => sum + row.leistung, 0);
  const db1 = orders.reduce((sum, row) => sum + row.db1, 0);
  const akte = orders.reduce((sum, row) => sum + row.akte, 0);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Leistung" value={leistung} hint={`${orders.length} Projekte`} />
        <Kpi label="DB I" value={db1} hint={`Marge ${num(leistung ? db1 / leistung * 100 : 0, 1)} %`} signed />
        <Kpi label="Ergebnis Akte" value={akte} hint={`Marge ${num(leistung ? akte / leistung * 100 : 0, 1)} %`} signed />
        <Kpi label="Variable Kosten" value={orders.reduce((sum, row) => sum + row.kvar, 0)} hint="Auftrag_Journal" />
      </section>
      <Panel title="Projekte nach Rentabilität">
        <DataTable rows={[...orders].sort((a, b) => b.akteMarge - a.akteMarge)} cols={[
          { key: "p", label: "Projekt", render: (row) => <><p className="font-medium">{row.name || row.nr}</p><p className="text-xs text-muted-foreground">{row.nr}</p></> },
          { key: "r", label: "Region", render: (row) => row.region },
          { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
          { key: "d", label: "DB I", right: true, render: (row) => eur(row.db1) },
          { key: "dm", label: "DB I-Marge", right: true, render: (row) => `${num(row.db1Marge, 1)} %` },
          { key: "a", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
          { key: "am", label: "Ergebnismarge", right: true, render: (row) => `${num(row.akteMarge, 1)} %` },
        ]} />
      </Panel>
    </div>
  );
}

function aggregateRegions(dash: Dash) {
  return Array.from(new Set(dash.orders.map((order) => order.region))).map((region) => {
    const rows = dash.orders.filter((order) => order.region === region);
    return {
      region,
      projekte: rows.length,
      leistung: rows.reduce((sum, row) => sum + row.leistung, 0),
      kvar: rows.reduce((sum, row) => sum + row.kvar, 0),
      kfix: rows.reduce((sum, row) => sum + row.kfix, 0),
      umlage: rows.reduce((sum, row) => sum + row.umlage, 0),
      akte: rows.reduce((sum, row) => sum + row.akte, 0),
    };
  });
}

type Metric = {
  name: string;
  formula: string;
  value?: (dash: Dash, month: number) => number | string | null;
  unit?: "eur" | "pct" | "num" | "days" | "months";
  missing?: string;
};
type MetricGroup = { name: string; metrics: Metric[] };

const missingBalance = "Bilanzdaten sind in der Excel-Datei nicht enthalten.";
const missingPeople = "Mitarbeiter- oder Stundendaten sind in der Excel-Datei nicht enthalten.";
const missingMarket = "Markt- oder Wettbewerbsdaten sind in der Excel-Datei nicht enthalten.";
const balance = (name: string, formula: string): Metric => ({ name, formula, missing: missingBalance });
const people = (name: string, formula: string): Metric => ({ name, formula, missing: missingPeople });
const market = (name: string, formula: string): Metric => ({ name, formula, missing: missingMarket });

const metricGroups: MetricGroup[] = [
  {
    name: "Allgemeine Bilanzkennzahlen",
    metrics: [
      balance("Vermögensaufbau (Konstitution)", "Anlagevermögen / Umlaufvermögen"),
      balance("Anlagenintensität (Anlagequote)", "Anlagevermögen / Bilanzsumme"),
      balance("Umlaufintensität (Umlaufquote)", "Umlaufvermögen / Bilanzsumme"),
      balance("Liquidität 1. Grades", "Liquide Mittel / kurzfristiges Fremdkapital"),
      balance("Liquidität 2. Grades", "(Liquide Mittel + Forderungen) / kurzfristiges Fremdkapital"),
      balance("Liquidität 3. Grades", "Umlaufvermögen / kurzfristiges Fremdkapital"),
      balance("Net Working Capital", "Umlaufvermögen − kurzfristiges Fremdkapital"),
      balance("Eigenkapitalquote", "Eigenkapital / Bilanzsumme"),
      balance("Fremdkapitalquote", "Fremdkapital / Bilanzsumme"),
      balance("Finanzierung (Kapitalaufbau)", "Eigenkapital / Fremdkapital"),
      balance("Verschuldungsgrad", "Fremdkapital / Eigenkapital"),
      balance("Anlagendeckungsgrad I", "Eigenkapital / Anlagevermögen"),
      balance("Anlagendeckungsgrad II", "(Eigenkapital + langfristiges Fremdkapital) / Anlagevermögen"),
      balance("Eigenkapitalrendite", "Ergebnis annualisiert / Eigenkapital"),
      balance("Gesamtkapitalrendite", "(Ergebnis + Zinsaufwand) annualisiert / Gesamtkapital"),
      { name: "Umsatzrendite", formula: "Ergebnis vor Steuern / Umsatzerlöse", unit: "pct", value: (dash, month) => ratio(monthResult(dash, month), dash.months[month - 1]?.umsatz) },
      { name: "Wirtschaftlichkeit", formula: "(Gesamtleistung + sonstige betriebliche Erträge) / Gesamtaufwand", unit: "num", value: (dash, month) => quotient((dash.months[month - 1]?.leistung ?? 0) + guvMonth(dash, "Andere sonstige betriebliche Ertraege", month), monthExpense(dash, month)) },
      balance("Umschlagshäufigkeit des Eigenkapitals", "Umsatz annualisiert / Eigenkapital"),
      balance("Umschlagshäufigkeit des Gesamtkapitals", "Umsatz annualisiert / Gesamtkapital"),
      balance("Return on Investment (ROI)", "Ergebnis annualisiert / Gesamtkapital"),
      balance("Umschlagshäufigkeit der Forderungen", "Umsatz annualisiert / Forderungen"),
      balance("Anteil überfälliger Forderungen", "überfällige / offene Forderungen"),
      balance("Forderungslaufzeit (DSO)", "Forderungen / Umsatz × 365"),
      balance("Kreditorenlaufzeit (DPO)", "Verbindlichkeiten / Material und Fremdleistung × 365"),
      balance("Bestandsreichweite (Inventory Days)", "Vorräte / Monatsleistung × 30"),
      { name: "Cash Flow (vereinfacht)", formula: "Ergebnis + Abschreibungen", unit: "eur", value: (dash, month) => monthResult(dash, month) - (dash.months[month - 1]?.abschreibungen ?? 0) },
      balance("Abschreibungsquote", "Abschreibungen / Anlagevermögen"),
      balance("Dynamischer Verschuldungsgrad", "Fremdkapital / Cashflow annualisiert"),
    ],
  },
  {
    name: "Personalwirtschaft",
    metrics: [
      people("Beschäftigungsstruktur", "gewerblich / angestellt"),
      people("Beschäftigungsgrad", "produktive Stunden / Gesamtstunden"),
      { name: "Personalaufwandsstruktur", formula: "Personalaufwand / Gesamtaufwand", unit: "pct", value: (dash, month) => ratio(Math.abs(guvMonth(dash, "Personalaufwand", month)), monthExpense(dash, month)) },
      { name: "Personalaufwandsquote", formula: "Personalaufwand / Gesamtleistung", unit: "pct", value: (dash, month) => ratio(Math.abs(guvMonth(dash, "Personalaufwand", month)), dash.months[month - 1]?.leistung) },
      people("Krankenquote", "Krankheitsstunden / Gesamtstunden"),
      people("Abwesenheitsstruktur", "Urlaub : Krankheit : Feiertag"),
      { name: "Lohnquote", formula: "Personalaufwand / Umsatzerlöse", unit: "pct", value: (dash, month) => ratio(Math.abs(guvMonth(dash, "Personalaufwand", month)), dash.months[month - 1]?.umsatz) },
      people("Leistung je Arbeitnehmer", "Umsatzerlöse / Mitarbeiter"),
      people("Fluktuationsziffer", "Abgänge / durchschnittliche Belegschaft"),
      people("Weiterbildungskosten je Mitarbeiter", "Weiterbildungskosten / Mitarbeiter"),
      people("Fehlzeitenquote", "Fehlzeiten / Gesamtstunden"),
      people("Durchschnittlicher Personalaufwand", "Personalaufwand / Mitarbeiter"),
      people("Gesamtleistung je Mitarbeiter", "Gesamtleistung / Mitarbeiter"),
      people("Altersstruktur der Belegschaft", "Altersklassen"),
    ],
  },
  {
    name: "Kennzahlensysteme",
    metrics: [
      balance("DuPont / ROI-Kennzahlenbaum", "ROI = Umsatzrendite × Kapitalumschlag"),
      { name: "Balanced Scorecard", formula: "Finanzen · Kunden · Prozesse · Mitarbeiter", missing: "Zielwerte sowie Kunden-, Prozess- und Mitarbeiterdaten fehlen in der Excel-Datei." },
    ],
  },
  {
    name: "Kennzahlen-Tools",
    metrics: [
      balance("Bilanzanalyse-Tool", "Strukturbilanz Eröffnung gegen aktuell"),
      { name: "BWA-Kennzahlen und Wasserfalldiagramm", formula: "Gesamtleistung → EBITDA", value: (dash, month) => dash.months[month - 1]?.ebitda ?? null, unit: "eur" },
      { name: "Visualisierung im Waffeldiagramm", formula: "Kostenstruktur des Monats", value: (dash, month) => monthExpense(dash, month), unit: "eur" },
      { name: "Visualisierung Plan-Ist-Vergleich", formula: "Gesamtleistung / EBITDA Plan gegen Ist je Monat", value: (dash, month) => dash.months[month - 1]?.ebitda ?? null, unit: "eur" },
    ],
  },
  {
    name: "Marketing und Absatz",
    metrics: [
      { name: "Umsatzstruktur", formula: "Umsatzanteile je Region", value: (dash, month) => {
        const values = dash.regions.map((region) => ({ region: region.region, value: region.umsatz[month - 1] ?? 0 }));
        const total = values.reduce((sum, row) => sum + row.value, 0);
        return total ? values.map((row) => `${row.region} ${num(ratio(row.value, total) ?? 0, 1)} %`).join(" · ") : null;
      } },
      { name: "Break-Even-Point", formula: "Fixkosten / Deckungsquote", unit: "eur", value: (dash, month) => {
        const fixed = Math.abs(guvMonth(dash, "Personalaufwand", month))
          + Math.abs(guvMonth(dash, "Sachkosten", month))
          + Math.abs(guvMonth(dash, "Abschreibungen", month));
        const output = dash.months[month - 1]?.leistung ?? 0;
        const variable = Math.abs(guvMonth(dash, "Vorleistungen", month));
        const margin = output ? 1 - variable / output : 0;
        return margin > 0 ? fixed / margin : null;
      } },
      market("Absoluter Marktanteil", "Umsatz / Marktvolumen"),
      market("Relativer Marktanteil", "eigener / größter Wettbewerber"),
      market("Marktwachstum", "Veränderung Marktvolumen"),
      { name: "Auftragsreichweite", formula: "Restplan Umsatz / durchschnittlicher Monatsumsatz", unit: "months", value: (dash) => {
        const rest = dash.forecastPlan.filter((row) => row.art === "plan" && row.groesse === "umsatz" && row.monat > dash.letzterIst).reduce((sum, row) => sum - row.wert, 0);
        const revenue = dash.months.filter((row) => row.ist).reduce((sum, row) => sum + row.umsatz, 0);
        return revenue && dash.letzterIst ? rest / (revenue / dash.letzterIst) : null;
      } },
      market("Akquisitionskosten je Kunde", "Vertriebskosten / Neukunden"),
    ],
  },
];

function guvMonth(dash: Dash, name: string, month: number) {
  return dash.guv.find((row) => row.name === name)?.values[month - 1] ?? 0;
}
function monthResult(dash: Dash, month: number) {
  const row = dash.months[month - 1];
  return row ? row.ebitda + row.abschreibungen + row.finanzergebnis : 0;
}
function monthExpense(dash: Dash, month: number) {
  return Math.abs(guvMonth(dash, "Vorleistungen", month))
    + Math.abs(guvMonth(dash, "Personalaufwand", month))
    + Math.abs(guvMonth(dash, "Sachkosten", month))
    + Math.abs(guvMonth(dash, "Abschreibungen", month));
}
function quotient(a: number | undefined, b: number | undefined) {
  return a != null && b ? a / b : null;
}
function ratio(a: number | undefined, b: number | undefined) {
  const value = quotient(a, b);
  return value == null ? null : value * 100;
}
function formatMetric(metric: Metric, value: number | string | null) {
  if (value == null) return "–";
  if (typeof value === "string") return value;
  if (metric.unit === "eur") return eur(value);
  if (metric.unit === "pct") return `${num(value, 1)} %`;
  if (metric.unit === "days") return `${num(value, 1)} Tage`;
  if (metric.unit === "months") return `${num(value, 1)} Monate`;
  return num(value, 2);
}

function KpiReport() {
  const { dash, user } = useDash();
  const storageKey = `tvf-report-kpis-${user.id}`;
  const [month, setMonth] = useState(dash.letzterIst);
  const [selected, setSelected] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  });
  const [view, setView] = useState<"catalog" | "report">("catalog");
  const toggle = (name: string) => {
    const next = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
    setSelected(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const chosen = metricGroups.map((group) => ({ ...group, metrics: group.metrics.filter((metric) => selected.includes(metric.name)) })).filter((group) => group.metrics.length);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-card print:hidden">
        <label className="text-xs font-medium text-muted-foreground">Monat
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-1 block rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
            {dash.monate.slice(0, dash.letzterIst).map((name, index) => <option key={name} value={index + 1}>{name} {dash.jahr}</option>)}
          </select>
        </label>
        <button className={reportButton} onClick={() => setView(view === "catalog" ? "report" : "catalog")}>{view === "catalog" ? `Bericht anzeigen (${selected.length})` : "Zur Auswahl"}</button>
        {view === "catalog" && <button className={reportButton} onClick={() => { setSelected([]); localStorage.removeItem(storageKey); }}>Auswahl leeren</button>}
        {view === "report" && <button className={reportButton} onClick={() => window.print()}><Printer className="h-4 w-4" />Drucken / PDF</button>}
      </div>
      {view === "catalog" ? metricGroups.map((group) => (
        <Panel key={group.name} title={group.name} subtitle={`${group.metrics.filter((metric) => selected.includes(metric.name)).length} / ${group.metrics.length} ausgewählt`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3">Bericht</th><th className="pb-3">Kennzahl</th><th className="pb-3">Formel / Quelle</th><th className="pb-3 text-right">{dash.monate[month - 1]}</th></tr></thead>
              <tbody>{group.metrics.map((metric) => {
                const value = metric.value ? metric.value(dash, month) : null;
                return <tr key={metric.name} className="border-t border-border">
                  <td className="py-3"><input type="checkbox" disabled={!metric.value} checked={selected.includes(metric.name)} onChange={() => toggle(metric.name)} /></td>
                  <td className="font-medium">{metric.name}</td>
                  <td className="text-muted-foreground"><p>{metric.formula}</p>{metric.missing && <p className="mt-1 text-xs text-negative">{metric.missing}</p>}</td>
                  <td className="text-right font-medium">{formatMetric(metric, value)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </Panel>
      )) : (
        <>
          <Panel title="TVF Kennzahlen" subtitle={`${selected.length} Kennzahlen · ${dash.monate[month - 1]} ${dash.jahr}`}>
            <p className="text-sm text-muted-foreground">Quelle: ausschließlich die importierten Blätter der Excel-Datenbasis. Nicht enthaltene Quellen bleiben im Katalog ausdrücklich ohne Wert.</p>
          </Panel>
          {chosen.length === 0 && <Panel title="Nichts ausgewählt"><p className="text-sm text-muted-foreground">Wählen Sie im Katalog berechenbare Kennzahlen aus.</p></Panel>}
          {chosen.map((group) => <Panel key={group.name} title={group.name}>
            <DataTable rows={group.metrics} cols={[
              { key: "k", label: "Kennzahl", render: (metric) => metric.name },
              { key: "f", label: "Formel / Quelle", render: (metric) => <span className="text-muted-foreground">{metric.formula}</span> },
              { key: "w", label: "Wert", right: true, render: (metric) => <span className="font-semibold">{formatMetric(metric, metric.value ? metric.value(dash, month) : null)}</span> },
            ]} />
          </Panel>)}
        </>
      )}
    </div>
  );
}

function reportSources(dash: Dash, journal: ReturnType<typeof useDash>["journal"]): Record<string, { label: string; description: string; rows: Row[] }> {
  return {
    guv: {
      label: "GuV je Position und Monat",
      description: "Die Positionen und Monatswerte aus GuV_Positionen.",
      rows: dash.guv.flatMap((row) => row.values.map((value, index) => ({ zeile: row.zeile, nummer: row.nr, position: row.name, monat: index + 1, wert: value }))),
    },
    projekte: {
      label: "Deckungsbeitrag je Projekt",
      description: "Leistung, Kostenstufen und Ergebnis aus dem Auftrag_Journal.",
      rows: dash.orders.map((row) => ({ auftrag: row.nr, name: row.name, region: row.region, status: row.status, leistung: row.leistung, variable_kosten: row.kvar, fixe_kosten: row.kfix, umlage: row.umlage, ergebnis_db: row.db, ergebnis_akte: row.akte, abgrenzung: row.abgrenzung })),
    },
    forecast_plan: {
      label: "Forecast je Auftrag",
      description: "Die eingegebenen Zeilen aus Forecast_Plan.",
      rows: dash.forecastPlan.map((row) => ({ region: row.region, auftrag: row.nr, auftragname: row.name, groesse: row.groesse, art: row.art, monat: row.monat, wert: row.wert })),
    },
    kostenverfolgung: {
      label: "Kostenverfolgung gegen SAP",
      description: "Meldung und berechnete SAP-Werte je Auftrag.",
      rows: dash.kostenverfolgung.map((row) => ({ psp: row.psp, auftrag: row.nr, titel: row.titel, region: row.region, umsatz_meldung: row.umsatzMeldung, kosten_meldung: row.kostenMeldung, ergebnis_meldung: row.ergebnisMeldung, umsatz_sap: row.umsatzSap, kosten_sap: row.kostenSap, ergebnis_sap: row.ergebnisSap, delta: row.delta, vertrag: row.vertrag })),
    },
    liquiditaet: {
      label: "Liquidität je Kalenderwoche",
      description: "Ein- und Auszahlungen sowie fortgeschriebener Bestand.",
      rows: dash.liquidity.weeks.map((row) => ({ datum: row.datum, jahr: row.jahr, monat: row.monat, einzahlungen: row.ein, auszahlungen: row.aus, netto: row.netto, bestand: row.bestand })),
    },
    buchungen: {
      label: "Einzelbuchungen",
      description: "Die Buchungszeilen mit Projekt-, Regions- und KLR-Merkmalen.",
      rows: journal.map((row) => ({ id: row.id, datum: row.datum, monat: row.monat, belegart: row.belegart, beleg: row.beleg, auftrag: row.nr, projekt: row.projekt, region: row.region, kostenart: row.kostenart, text: row.text, wert: row.wert, guv_gruppe: row.guvGruppe, belegkreis: row.belegkreis, kostentraeger: row.kostentraeger, leistung: row.leistung, k_var: row.kvar, k_fix: row.kfix, umlage: row.umlage, beitrag: row.beitrag })),
    },
  };
}

const blankBuilder: BuilderState = { spalten: [], filter: [], gruppierung: [], aggregat: "summe", rechenspalten: [], grenze: 500 };
const comparisons = [
  ["=", "ist gleich"], ["<>", "ist ungleich"], [">", "größer als"], [">=", "größer oder gleich"],
  ["<", "kleiner als"], ["<=", "kleiner oder gleich"], ["enthaelt", "enthält"], ["beginnt", "beginnt mit"],
  ["leer", "ist leer"], ["nichtleer", "ist nicht leer"],
] as const;

function ReportBuilder() {
  const store = useDash();
  const sources = useMemo(() => reportSources(store.dash, store.journal), [store.dash, store.journal]);
  const [source, setSource] = useState(Object.keys(sources)[0]);
  const [state, setState] = useState<BuilderState>(blankBuilder);
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState("");
  const columns = sourceColumns(sources[source].rows);
  const result = useMemo(() => runBuilder(sources[source].rows, state, columns), [sources, source, state, columns]);

  useEffect(() => {
    fetch("/api/report-templates").then((response) => response.json()).then((data) => setTemplates(data.vorlagen ?? [])).catch(() => setTemplates([]));
  }, []);

  const set = (partial: Partial<BuilderState>) => setState((current) => ({ ...current, ...partial }));
  const save = async () => {
    setMessage("");
    const response = await fetch("/api/report-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quelle: source, aufbau: state }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Speichern fehlgeschlagen."); return; }
    const next = { id: data.id, name, quelle: source, aufbau: state, geaendertAt: new Date().toISOString() };
    setTemplates((current) => [...current.filter((item) => item.name !== name), next].sort((a, b) => a.name.localeCompare(b.name, "de")));
    setMessage(`Vorlage „${name}“ gespeichert.`);
  };
  const remove = async (template: Template) => {
    const response = await fetch(`/api/report-templates?id=${template.id}`, { method: "DELETE" });
    if (response.ok) setTemplates((current) => current.filter((item) => item.id !== template.id));
  };

  return (
    <div className="space-y-6">
      {message && <p className="rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}
      <Panel title="Woraus soll gerechnet werden?" subtitle="Schritt 1">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Datenquelle
            <select value={source} onChange={(event) => { setSource(event.target.value); setState(blankBuilder); }} className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2">
              {Object.entries(sources).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{sources[source].description}</span>
          </label>
          <label className="text-sm font-medium">Höchstens Zeilen
            <input type="number" min={1} max={5000} value={state.grenze} onChange={(event) => set({ grenze: Math.min(5000, Math.max(1, Number(event.target.value))) })} className="mt-1.5 w-full rounded-lg border border-input px-3 py-2" />
          </label>
        </div>
      </Panel>
      <Panel title="Spalten ein- und ausblenden" subtitle="Schritt 2 · nichts gewählt heißt alle">
        <div className="flex flex-wrap gap-2">{columns.map((column) => <label key={column.name} className={`rounded-full border px-3 py-1.5 text-xs ${state.spalten.includes(column.name) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}><input type="checkbox" className="sr-only" checked={state.spalten.includes(column.name)} onChange={() => set({ spalten: state.spalten.includes(column.name) ? state.spalten.filter((item) => item !== column.name) : [...state.spalten, column.name] })} />{column.name}{column.numeric ? " · Σ" : ""}</label>)}</div>
      </Panel>
      <Panel title="Filtern" subtitle="Schritt 3 · Bedingungen gelten gleichzeitig">
        <div className="space-y-3">
          {state.filter.map((filter, index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <select value={filter.spalte} onChange={(event) => set({ filter: state.filter.map((item, i) => i === index ? { ...item, spalte: event.target.value } : item) })} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">{columns.map((column) => <option key={column.name}>{column.name}</option>)}</select>
            <select value={filter.op} onChange={(event) => set({ filter: state.filter.map((item, i) => i === index ? { ...item, op: event.target.value } : item) })} className="rounded-lg border border-input bg-card px-3 py-2 text-sm">{comparisons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <input disabled={["leer", "nichtleer"].includes(filter.op)} value={filter.wert} onChange={(event) => set({ filter: state.filter.map((item, i) => i === index ? { ...item, wert: event.target.value } : item) })} className="rounded-lg border border-input px-3 py-2 text-sm" />
            <button onClick={() => set({ filter: state.filter.filter((_, i) => i !== index) })} className={reportButton}>entfernen</button>
          </div>)}
          <button onClick={() => set({ filter: [...state.filter, { spalte: columns[0]?.name ?? "", op: "=", wert: "" }] })} className={reportButton}>Bedingung hinzufügen</button>
        </div>
      </Panel>
      <Panel title="Gruppieren und verdichten" subtitle="Schritt 4">
        <div className="flex flex-wrap gap-2">{columns.filter((column) => !column.numeric).map((column) => <label key={column.name} className={`rounded-full border px-3 py-1.5 text-xs ${state.gruppierung.includes(column.name) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}><input type="checkbox" className="sr-only" checked={state.gruppierung.includes(column.name)} onChange={() => set({ gruppierung: state.gruppierung.includes(column.name) ? state.gruppierung.filter((item) => item !== column.name) : [...state.gruppierung, column.name] })} />{column.name}</label>)}</div>
        {!!state.gruppierung.length && <label className="mt-4 block max-w-xs text-sm font-medium">Rechenart
          <select value={state.aggregat} onChange={(event) => set({ aggregat: event.target.value as BuilderState["aggregat"] })} className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2"><option value="summe">Summe</option><option value="anzahl">Anzahl</option><option value="mittel">Mittelwert</option><option value="min">Minimum</option><option value="max">Maximum</option></select>
        </label>}
      </Panel>
      <Panel title="Eigene Berechnungen" subtitle="Schritt 5 · Spaltennamen, Zahlen, Klammern und + − × ÷">
        <div className="space-y-3">{state.rechenspalten.map((calculation, index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"><input placeholder="Name" value={calculation.name} onChange={(event) => set({ rechenspalten: state.rechenspalten.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} className="rounded-lg border border-input px-3 py-2 text-sm" /><input placeholder="leistung - variable_kosten" value={calculation.formel} onChange={(event) => set({ rechenspalten: state.rechenspalten.map((item, i) => i === index ? { ...item, formel: event.target.value } : item) })} className="rounded-lg border border-input px-3 py-2 text-sm" /><button onClick={() => set({ rechenspalten: state.rechenspalten.filter((_, i) => i !== index) })} className={reportButton}>entfernen</button></div>)}</div>
        <button onClick={() => set({ rechenspalten: [...state.rechenspalten, { name: "", formel: "" }] })} className={`${reportButton} mt-3`}>Berechnung hinzufügen</button>
      </Panel>
      <Panel title="Ergebnis" subtitle={`${result.rows.length} Zeilen`}>
        <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
          <label className="min-w-60 flex-1 text-xs font-medium text-muted-foreground">Als Vorlage speichern unter<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 block w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
          <button disabled={!name.trim()} onClick={() => void save()} className={reportButton}>Speichern</button>
          <button onClick={() => downloadCsv(`${name || "bericht"}.csv`, result.rows, result.columns)} className={reportButton}><Download className="h-4 w-4" />Als CSV</button>
        </div>
        <ResultTable rows={result.rows} columns={result.columns} />
      </Panel>
      {!!templates.length && <Panel title="Vorlagen" subtitle="Gespeichert">
        <DataTable rows={templates} cols={[
          { key: "n", label: "Name", render: (template) => <span className="font-medium">{template.name}</span> },
          { key: "q", label: "Datenquelle", render: (template) => sources[template.quelle]?.label ?? template.quelle },
          { key: "d", label: "Geändert", render: (template) => template.geaendertAt.slice(0, 10).split("-").reverse().join(".") },
          { key: "a", label: "", right: true, render: (template) => <span className="inline-flex gap-2"><button className={reportButton} onClick={() => { setSource(template.quelle); setState(template.aufbau); setName(template.name); }}>laden</button><button className={reportButton} onClick={() => void remove(template)}>löschen</button></span> },
        ]} />
      </Panel>}
    </div>
  );
}

function sourceColumns(rows: Row[]) {
  const names = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return names.map((name) => ({ name, numeric: rows.some((row) => typeof row[name] === "number") }));
}

function compare(value: unknown, filter: Filter) {
  const text = value == null ? "" : String(value);
  if (filter.op === "leer") return text === "";
  if (filter.op === "nichtleer") return text !== "";
  if (filter.op === "enthaelt") return text.toLocaleLowerCase("de").includes(filter.wert.toLocaleLowerCase("de"));
  if (filter.op === "beginnt") return text.toLocaleLowerCase("de").startsWith(filter.wert.toLocaleLowerCase("de"));
  const leftNumber = Number(value), rightNumber = Number(filter.wert);
  const [left, right] = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) ? [leftNumber, rightNumber] : [text, filter.wert];
  if (filter.op === "=") return left === right;
  if (filter.op === "<>") return left !== right;
  if (filter.op === ">") return left > right;
  if (filter.op === ">=") return left >= right;
  if (filter.op === "<") return left < right;
  if (filter.op === "<=") return left <= right;
  return true;
}

function runBuilder(rows: Row[], state: BuilderState, columns: { name: string; numeric: boolean }[]) {
  let result = rows.filter((row) => state.filter.every((filter) => compare(row[filter.spalte], filter)));
  const selected = state.spalten.length ? state.spalten : columns.map((column) => column.name);
  if (state.gruppierung.length) {
    const groups = new Map<string, Row[]>();
    result.forEach((row) => {
      const key = JSON.stringify(state.gruppierung.map((column) => row[column]));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
    const numeric = columns.filter((column) => column.numeric && selected.includes(column.name)).map((column) => column.name);
    result = Array.from(groups.values()).map((group) => {
      const row: Row = Object.fromEntries(state.gruppierung.map((column) => [column, group[0][column]]));
      numeric.forEach((column) => {
        const values = group.map((item) => Number(item[column])).filter(Number.isFinite);
        row[column] = state.aggregat === "anzahl" ? values.length
          : state.aggregat === "mittel" ? values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
          : state.aggregat === "min" ? Math.min(...values)
          : state.aggregat === "max" ? Math.max(...values)
          : values.reduce((sum, value) => sum + value, 0);
      });
      return row;
    });
  } else {
    result = result.map((row) => Object.fromEntries(selected.map((column) => [column, row[column]])));
  }
  result = result.slice(0, state.grenze).map((row) => {
    const calculated = { ...row };
    state.rechenspalten.forEach((calculation) => {
      if (calculation.name.trim()) calculated[calculation.name.trim()] = calculate(calculation.formel, calculated);
    });
    return calculated;
  });
  return { rows: result, columns: result.length ? Object.keys(result[0]) : [...(state.gruppierung.length ? state.gruppierung : selected), ...state.rechenspalten.map((item) => item.name).filter(Boolean)] };
}

function calculate(formula: string, row: Row): number | null {
  const tokens = formula.match(/[A-Za-z_ÄÖÜäöüß][\wÄÖÜäöüß]*|\d+(?:[.,]\d+)?|[()+\-*/]/g) ?? [];
  if (tokens.join("").replace(/,/g, ".") !== formula.replace(/\s/g, "").replace(/,/g, ".")) return null;
  const output: (number | string)[] = [], operators: string[] = [];
  const priority: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  for (const token of tokens) {
    if (/^\d/.test(token)) output.push(Number(token.replace(",", ".")));
    else if (/^[A-Za-z_ÄÖÜäöüß]/.test(token)) {
      const value = Number(row[token]);
      if (!Number.isFinite(value)) return null;
      output.push(value);
    } else if (token === "(") operators.push(token);
    else if (token === ")") {
      while (operators.length && operators.at(-1) !== "(") output.push(operators.pop()!);
      if (operators.pop() !== "(") return null;
    } else {
      while (operators.length && operators.at(-1) !== "(" && priority[operators.at(-1)!] >= priority[token]) output.push(operators.pop()!);
      operators.push(token);
    }
  }
  while (operators.length) {
    const operator = operators.pop()!;
    if (operator === "(") return null;
    output.push(operator);
  }
  const stack: number[] = [];
  for (const token of output) {
    if (typeof token === "number") stack.push(token);
    else {
      const right = stack.pop(), left = stack.pop();
      if (left == null || right == null || (token === "/" && right === 0)) return null;
      stack.push(token === "+" ? left + right : token === "-" ? left - right : token === "*" ? left * right : left / right);
    }
  }
  return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : null;
}

function ResultTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{columns.map((column) => <th key={column} className="whitespace-nowrap px-2 pb-3">{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border">{columns.map((column) => <td key={column} className={`whitespace-nowrap px-2 py-2.5 ${typeof row[column] === "number" ? "text-right tabular-nums" : ""}`}>{typeof row[column] === "number" ? num(Number(row[column]), 2) : String(row[column] ?? "–")}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <p className="py-8 text-center text-sm text-muted-foreground">Keine Zeile passt zu den Bedingungen.</p>}
    </div>
  );
}
