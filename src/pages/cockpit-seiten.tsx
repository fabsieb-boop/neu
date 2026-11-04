import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useDash } from "@/data";
import { DataTable, eur, Kpi, PageHeader, Panel } from "@/components/dash";
import { IstFreigabe } from "@/components/ist-freigabe";
import { Stammdaten } from "@/pages/stammdaten";
import { Legende, Liquiditaetsannahmen, MappeParameter } from "@/pages/einstellungen";

function Rahmen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">{children}</main>
    </div>
  );
}

export function Lagebild() {
  const { dash } = useDash();
  const offen = dash.months.find((monat) => monat.offen) ?? dash.months[dash.letzterIst - 1];
  const folge = dash.months.filter((monat) => offen && monat.m > offen.m);
  const ende = dash.liquidity.weeks.at(-1)?.bestand ?? 0;
  if (!offen) return null;
  return (
    <Rahmen title="Lagebild" subtitle={offen.offen ? `${offen.name} ist der offene Monat: Plan in der Jahreszahl, Buchungen daneben.` : `${offen.name} ist freigegeben.`}>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`${offen.name} Umsatz Plan`} value={offen.umsatz} hint={`Ist ${eur(offen.umsatzIst)}`} signed />
        <Kpi label={`${offen.name} Bestand Plan`} value={offen.bestand} hint={`Ist ${eur(offen.bestandIst)}`} signed />
        <Kpi label={`${offen.name} EBITDA Plan`} value={offen.ebitda} hint={`Gebucht ${eur(offen.ebitdaIst)}`} signed />
        <Kpi label="Bestand 26 Wochen" value={ende} hint="Liquiditätsplan" signed icon />
      </section>
      <Panel title="Auftragsergebnis des offenen Monats" subtitle="Projekte, ergebnisrelevant">
        <p className={`font-display text-3xl font-semibold ${offen.auftragsergebnis < 0 ? "text-negative" : ""}`}>{eur(offen.auftragsergebnis)}</p>
      </Panel>
      {folge.length > 0 && (
        <Panel title="Plan der Folgemonate" subtitle="Diese Monate bleiben Plan, bis sie freigegeben werden.">
          <DataTable rows={folge} cols={[
            { key: "m", label: "Monat", render: (row) => row.name },
            { key: "u", label: "Umsatz", right: true, render: (row) => eur(row.umsatz) },
            { key: "b", label: "Bestand", right: true, render: (row) => eur(row.bestand) },
            { key: "e", label: "EBITDA", right: true, render: (row) => eur(row.ebitda) },
          ]} />
        </Panel>
      )}
    </Rahmen>
  );
}

export function Monatsanalyse() {
  const { dash } = useDash();
  const [monat, setMonat] = useState(dash.aktuellerMonat ?? dash.letzterIst);
  const zeile = dash.months[monat - 1];
  const name = dash.monate[monat - 1] ?? "";
  return (
    <Rahmen title="Monatsanalyse" subtitle={`${name}: gebuchte GuV und der in der Jahressumme verwendete Wert.`}>
      <label className="text-xs font-medium text-muted-foreground">
        Monat
        <select value={monat} onChange={(event) => setMonat(Number(event.target.value))} className="mt-1 block rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
          {dash.monate.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
      </label>
      {zeile && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Umsatz angezeigt" value={zeile.umsatz} hint={`Ist ${eur(zeile.umsatzIst)}`} signed />
          <Kpi label="EBITDA angezeigt" value={zeile.ebitda} hint={`Gebucht ${eur(zeile.ebitdaIst)}`} signed />
          <Kpi label="Auftragsergebnis" value={zeile.auftragsergebnis} hint="Journal der Projekte" signed />
          <Kpi label="Leistung angezeigt" value={zeile.leistung} hint={`Ist ${eur(zeile.leistungIst)}`} signed />
        </section>
      )}
      <Panel title={`GuV ${name}`} subtitle="Oben die Buchungen, in der zweiten Spalte der Wert der Jahressumme.">
        <DataTable rows={dash.guv} cols={[
          { key: "n", label: "Position", render: (row) => row.name },
          { key: "i", label: "Gebucht", right: true, render: (row) => eur(row.ist[monat - 1] ?? 0) },
          { key: "p", label: "In der Jahressumme", right: true, render: (row) => eur(row.values[monat - 1] ?? 0) },
        ]} />
      </Panel>
    </Rahmen>
  );
}

export function Abgrenzungen() {
  const { dash } = useDash();
  const rows = dash.orders.filter((order) => order.abgrenzung !== 0);
  const summe = rows.reduce((total, order) => total + order.abgrenzung, 0);
  return (
    <Rahmen title="Abgrenzungen" subtitle="Differenz aus Ergebnis DB und Ergebnis Akte.">
      <Kpi label="Abgrenzung" value={summe} hint={`${rows.length.toLocaleString("de-DE")} Aufträge mit Differenz`} signed />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ergebnis DB und Ergebnis Akte sind in diesem Stand gleich.</p>
      ) : (
        <Panel title="Aufträge">
          <DataTable rows={rows} cols={[
            { key: "a", label: "Auftrag", render: (row) => <Link to={`/projektsuche?nr=${encodeURIComponent(row.nr)}`} className="font-medium hover:underline">{row.name || row.nr}</Link> },
            { key: "r", label: "Region", render: (row) => row.region },
            { key: "d", label: "Ergebnis DB", right: true, render: (row) => eur(row.db) },
            { key: "k", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
            { key: "g", label: "Abgrenzung", right: true, render: (row) => eur(row.abgrenzung) },
          ]} />
        </Panel>
      )}
    </Rahmen>
  );
}

export function Bestaende() {
  const { dash } = useDash();
  return (
    <Rahmen title="Bestände" subtitle="Bestandsveränderung je Monat. Im offenen Monat stehen Plan und Buchung.">
      <DataTable rows={dash.months} cols={[
        { key: "m", label: "Monat", render: (row) => row.name },
        { key: "i", label: "Gebucht", right: true, render: (row) => eur(row.bestandIst) },
        { key: "a", label: "Angezeigt", right: true, render: (row) => eur(row.bestand) },
      ]} />
    </Rahmen>
  );
}

export function Datenstatus() {
  const { dash, journal } = useDash();
  const monat = dash.aktuellerMonat ?? dash.letzterIst;
  const scheibe = journal.filter((row) => row.monat === monat).length;
  return (
    <Rahmen title="Datenstatus" subtitle={`Geschäftsjahr ${dash.jahr}, freigegeben bis ${dash.letzterIstName}.`}>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Buchungen im Jahr" value={journal.length} hint="Journal" plain />
        <Kpi label={`${dash.monate[monat - 1] ?? ""} gebucht`} value={scheibe} hint="Zeilen in dieser Periode" plain />
        <Kpi label="Projekte" value={dash.projektstamm.length} hint="Projektstamm" plain />
        <Kpi label="Kontoauszug" value={dash.bank.anzahl} hint={dash.bank.anzahl ? eur(dash.bank.summe) : "keine Bankzeilen"} plain />
      </section>
      <MappeParameter />
      <Stammdaten eingebettet />
    </Rahmen>
  );
}

function Texttreffer({ title, muster, leer }: { title: string; muster: RegExp; leer: string }) {
  const { journal } = useDash();
  const rows = journal.filter((row) => muster.test(`${row.text} ${row.kostenart} ${row.guvGruppe}`));
  const summe = rows.reduce((total, row) => total + row.wert, 0);
  return (
    <Rahmen title={title} subtitle={rows.length ? `${rows.length.toLocaleString("de-DE")} Buchungen, Summe ${eur(summe)}` : leer}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{leer}</p> : (
        <DataTable rows={rows} cols={[
          { key: "d", label: "Datum", render: (row) => row.datum.split("-").reverse().join(".") },
          { key: "b", label: "Beleg", render: (row) => row.beleg },
          { key: "p", label: "Auftrag", render: (row) => <Link to={`/projektsuche?nr=${encodeURIComponent(row.nr)}`} className="hover:underline">{row.nr}</Link> },
          { key: "t", label: "Text", render: (row) => row.text || row.kostenart },
          { key: "w", label: "Wert", right: true, render: (row) => eur(row.wert) },
        ]} />
      )}
    </Rahmen>
  );
}

export function Skonto() {
  return <Texttreffer title="Skonto" muster={/skonto/i} leer="Im Journal steht keine Buchung mit Skonto." />;
}

export function Rueckstellungen() {
  return <Texttreffer title="Rückstellungsspiegel" muster={/r[üu]ckstell/i} leer="Im Journal steht keine Rückstellungsbuchung." />;
}

export function Umlagen() {
  const { journal } = useDash();
  const rows = journal.filter((row) => row.belegkreis === "Umlage");
  const summe = rows.reduce((total, row) => total + row.umlage, 0);
  return (
    <Rahmen title="Umlagen" subtitle="Belege mit Nummernkreis 9900.">
      <Kpi label="Umlage" value={summe} hint={`${rows.length.toLocaleString("de-DE")} Buchungen`} signed />
      <DataTable rows={rows} cols={[
        { key: "d", label: "Datum", render: (row) => row.datum.split("-").reverse().join(".") },
        { key: "b", label: "Beleg", render: (row) => row.beleg },
        { key: "p", label: "Auftrag", render: (row) => <Link to={`/projektsuche?nr=${encodeURIComponent(row.nr)}`} className="hover:underline">{row.nr}</Link> },
        { key: "t", label: "Text", render: (row) => row.text },
        { key: "w", label: "Umlage", right: true, render: (row) => eur(row.umlage) },
      ]} />
    </Rahmen>
  );
}

export function Unterprojekte() {
  return (
    <Rahmen title="Unteraufträge" subtitle="Eigene Unteraufträge sind in diesem Datenstand nicht gespeichert.">
      <p className="text-sm text-muted-foreground">Die Aufträge des Projektstamms stehen unter Projektsuche / Akte.</p>
    </Rahmen>
  );
}

export function Stunden() {
  return (
    <Rahmen title="Stunden" subtitle="Stunden sind in diesem Datenstand nicht gespeichert.">
      <p className="text-sm text-muted-foreground">Lohn und Personal stehen in der GuV unter Personalaufwand.</p>
    </Rahmen>
  );
}

export function Risiken() {
  const { dash } = useDash();
  return (
    <Rahmen title="Risiken" subtitle={dash.verluste.length ? `${dash.verluste.length.toLocaleString("de-DE")} Verlustzeilen` : "Keine Verlustzeilen im Forecast."}>
      {dash.verluste.length === 0 ? <p className="text-sm text-muted-foreground">Der Forecast enthält keine offene Verlustbewertung.</p> : (
        <DataTable rows={dash.verluste} cols={[
          { key: "m", label: "Monat", render: (row) => `${row.monat}.${row.jahr}` },
          { key: "r", label: "Region", render: (row) => row.region },
          { key: "p", label: "Projekt", render: (row) => row.projekt },
          { key: "b", label: "Betrag", right: true, render: (row) => eur(row.betrag) },
          { key: "n", label: "Notiz", render: (row) => row.notiz },
        ]} />
      )}
    </Rahmen>
  );
}

export function Kalkulation() {
  const { dash } = useDash();
  const rows = dash.projektstamm
    .filter((projekt) => projekt.nr !== "OVERHEAD" && projekt.nr !== "BEWERTUNG")
    .map((projekt) => {
      const auftrag = dash.orders.find((order) => order.nr === projekt.nr);
      return { ...projekt, leistung: auftrag?.leistung ?? 0, akte: auftrag?.akte ?? 0 };
    });
  return (
    <Rahmen title="Kalkulation HK/SK" subtitle="Budget aus dem Projektstamm, Leistung und Ergebnis aus dem Journal.">
      <DataTable rows={rows} cols={[
        { key: "p", label: "Projekt", render: (row) => <><Link to={`/projektsuche?nr=${encodeURIComponent(row.nr)}`} className="font-medium hover:underline">{row.name || row.nr}</Link><p className="text-xs text-muted-foreground">{row.nr} · {row.region}</p></> },
        { key: "u", label: "Budget Umsatz", right: true, render: (row) => eur(row.budgetUmsatz) },
        { key: "k", label: "Budget Kosten", right: true, render: (row) => eur(row.budgetKosten) },
        { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
        { key: "e", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
      ]} />
    </Rahmen>
  );
}

export function ForecastProjekte() {
  const { dash } = useDash();
  const [suche, setSuche] = useState("");
  const index = (dash.aktuellerMonat ?? dash.letzterIst + 1) - 1;
  const rows = dash.forecastOrders.filter((order) => `${order.nr} ${order.name} ${order.region}`.toLowerCase().includes(suche.toLowerCase()));
  return (
    <Rahmen title="Forecast je Projekt" subtitle="Jahressumme und der offene Monat. Die Monatsspalten je Region stehen unter Forecast je Auftrag.">
      <input value={suche} onChange={(event) => setSuche(event.target.value)} placeholder="Projekt suchen …" className="w-full max-w-md rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      <DataTable rows={rows} cols={[
        { key: "p", label: "Projekt", render: (row) => <><Link to={`/projektsuche?nr=${encodeURIComponent(row.nr)}`} className="font-medium hover:underline">{row.name || row.nr}</Link><p className="text-xs text-muted-foreground">{row.nr} · {row.region}</p></> },
        { key: "j", label: "Jahr", right: true, render: (row) => eur(row.monate.reduce((sum, value) => sum + value, 0)) },
        { key: "a", label: "Offener Monat Plan", right: true, render: (row) => eur(row.monate[index] ?? 0) },
        { key: "i", label: "Offener Monat Ist", right: true, render: (row) => eur(row.istMonate[index] ?? 0) },
      ]} />
    </Rahmen>
  );
}

export function Annahmen() {
  return (
    <Rahmen title="Annahmen" subtitle="Liquidität und Rechenwege der Mappe.">
      <Liquiditaetsannahmen />
      <Legende />
    </Rahmen>
  );
}

export function Bilanz() {
  const { dash } = useDash();
  return (
    <Rahmen title="Bilanz" subtitle="Gespeicherte Kontostände. Eine ausgebaute Bilanz liegt in diesem Stand nicht vor.">
      <Panel title="Kontostände">
        {dash.konto.length === 0 ? <p className="text-sm text-muted-foreground">Kein Kontostand gespeichert.</p> : (
          <DataTable rows={dash.konto} cols={[
            { key: "k", label: "Konto", render: (row) => row.konto },
            { key: "s", label: "Stichtag", render: (row) => row.stichtag.split("-").reverse().join(".") },
            { key: "b", label: "Saldo", right: true, render: (row) => eur(row.saldo) },
          ]} />
        )}
      </Panel>
      <Panel title="Cash-Pool">
        <DataTable rows={dash.liqBestand} cols={[
          { key: "m", label: "Monat", render: (row) => dash.monate[row.monat - 1] ?? String(row.monat) },
          { key: "q", label: "Quelle", render: (row) => row.quelle },
          { key: "s", label: "Saldo", right: true, render: (row) => eur(row.saldo) },
        ]} />
      </Panel>
    </Rahmen>
  );
}

export function Monatsroll() {
  const { dash } = useDash();
  const ab = dash.aktuellerMonat ?? dash.letzterIst + 1;
  const rows = dash.forecast.filter((monat) => monat.m >= ab);
  return (
    <Rahmen title="Monatsroll" subtitle="Ab dem offenen Monat: gebuchte Projektleistung und der angezeigte Plan.">
      <DataTable rows={rows} cols={[
        { key: "m", label: "Monat", render: (row) => row.name },
        { key: "j", label: "Gebucht", right: true, render: (row) => eur(row.leistungJournal) },
        { key: "u", label: "Umsatz Plan", right: true, render: (row) => eur(row.umsatzPlan ?? 0) },
        { key: "k", label: "Kosten Plan", right: true, render: (row) => eur(row.kostenPlan ?? 0) },
        { key: "a", label: "Angezeigt", right: true, render: (row) => eur(row.angezeigt) },
      ]} />
    </Rahmen>
  );
}

export function Freigaben() {
  const { dash } = useDash();
  return (
    <Rahmen title="Freigaben" subtitle={`Gebucht bis ${dash.letzterIstName}. Die Mappe steht auf ${dash.mappeMonatName}. ${dash.aktuellerMonatName ?? "Kein Monat"} zeigt Plan und die gebuchte Scheibe.`}>
      <IstFreigabe />
    </Rahmen>
  );
}
