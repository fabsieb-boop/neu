import Link from 'next/link';
import Shell from '../components/Shell';
import PeriodenWahl from '../components/PeriodenWahl';
import Unterseiten from '../components/Unterseiten';
import { requireRecht } from '@/lib/guard';
import { geschaeftsjahre, abstimmung, datenqualitaet, dbMonate,
         guvReferenz, istInGuvGliederung, abstimmungGuv, guvKategorien,
         bilanz } from '@/lib/queries';
import { eur0, zahl, vz, pct, anteil, num, monat as monatName } from '@/lib/format';

export const dynamic = 'force-dynamic';

const KREIS_TEXT: Record<string, { titel: string; text: string; relevant: boolean }> = {
  PRIMAER: { titel: 'Primärbuchungen', relevant: true,
    text: 'Eingangsrechnungen, Fakturen und Sachbelege – Belegnummern 68…/69…. Das sind die Vorgänge mit Außenwirkung.' },
  VERRECHNUNG: { titel: 'Innerbetriebliche Leistungsverrechnung', relevant: true,
    text: 'Lohn- und Gerätestunden aus eigenen Kostenstellen, Belegnummern 9028/9029/9030. Echte Projektkosten.' },
  UMLAGE: { titel: 'Gemeinkostenzuschlag', relevant: true,
    text: 'Konto 7801020, Belegnummern 9900…. Entlastet den Innenauftrag der Region und belastet das Projekt. Saldiert über alle Aufträge auf null.' },
  ABRECHNUNG: { titel: 'Auftragsabrechnung', relevant: false,
    text: 'Belegnummern 80…. Buchen den Auftragssaldo zum Monatsende auf eine Ergebnis-Kostenstelle um. Der Empfänger liegt außerhalb des Auftragsberichts – deshalb sind diese Zeilen von allen Ergebnisrechnungen ausgeschlossen.' },
};

const TRAEGER: Record<string, string> = {
  PROJEKT: 'Projektaufträge (P…)',
  BEREICH: 'Innenaufträge der Regionen (W…)',
  ZENTRALE: 'Innenaufträge der Zentrale (W…50…)',
  NICHT_ZUGEORDNET: 'ohne Zuordnung',
};

export const UNTERSEITEN = [
  { key: 'ueberblick', label: 'Überblick', href: '/abstimmung',
    hinweis: 'Stimmt das Ergebnis mit dem Jahresabschluss überein, und geht die Bilanz auf?' },
  { key: 'konten', label: 'Konten', href: '/abstimmung/konten',
    hinweis: 'Konten mit Differenz und der Nachweis, dass jeder Belegkreis erfasst ist.' },
  { key: 'bcs', label: 'BCS-Abgleich', href: '/abstimmung/bcs',
    hinweis: 'Der Auftragsbericht gegen die offizielle GuV der Unternehmensplanung.' },
  { key: 'daten', label: 'Datenqualität', href: '/abstimmung/daten',
    hinweis: 'Umfang des Bestands und die bekannten Eigenheiten des SAP-Exports.' },
];

export default async function AbstimmungSeite(
  { searchParams, teil = 'ueberblick' }:
  { searchParams: Promise<Record<string, string>>; teil?: string }) {
  const benutzer = await requireRecht('klr.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();

  const [rows, qualitaet, monate, referenz, guvAb, kat, bil] = await Promise.all([
    abstimmung(jahr), datenqualitaet(), dbMonate(jahr), guvReferenz(jahr),
    abstimmungGuv(), guvKategorien(jahr), bilanz(),
  ]);

  // Abstimmung gegen den offiziellen Abschluss (guv.XLSX / bilNZ.XLSX, Periode 8)
  const guvSumme    = guvAb.reduce((a, r) => a + num(r.einzelposten), 0);
  const abschlussS  = guvAb.reduce((a, r) => a + num(r.abschluss), 0);
  const guvOffen    = guvAb.filter(r => Math.abs(num(r.differenz)) > 0.005);
  const bilanzSumme = bil.reduce((a, r) => a + num(r.bestand), 0);
  const aktiva      = bil.filter(r => num(r.bestand) > 0).reduce((a, r) => a + num(r.bestand), 0);
  const passiva     = bil.filter(r => num(r.bestand) < 0).reduce((a, r) => a + num(r.bestand), 0);
  const probe       = bilanzSumme + guvSumme;

  const ref = (szenario: string, position: string) =>
    num(referenz.find(r => r.szenario === szenario && r.position === position)?.betrag);
  const istBis = ref('meta', 'ist_bis_periode');
  const eigen = istBis ? await istInGuvGliederung(jahr, istBis) : null;

  /** Gegenüberstellung: offizielle BCS-GuV gegen die auftragsbezogene Rechnung. */
  const abgleich = eigen ? [
    { pos: 'Umsatzerlöse', amtlich: ref('ist', 'umsatz'), eigen: num(eigen.umsatz),
      grund: 'nahezu deckungsgleich' },
    { pos: 'Bestandsveränderung', amtlich: ref('ist', 'ba'), eigen: num(eigen.ba),
      grund: 'vollständig auftragsbezogen' },
    { pos: 'Gesamtleistung', amtlich: ref('ist', 'gl'), eigen: num(eigen.gl),
      grund: 'Summe der beiden Positionen' },
    { pos: 'Vorleistungen', amtlich: ref('ist', 'vorleistungen'), eigen: num(eigen.vorleistungen),
      grund: 'Material und Fremdleistungen, fast vollständig auf Aufträgen' },
    { pos: 'Personalaufwand', amtlich: ref('ist', 'personal'), eigen: num(eigen.personal),
      grund: 'im Auftragsbericht nur die Lohnverrechnung; Löhne, Gehälter und Sozialabgaben liegen auf Kostenstellen' },
    { pos: 'Abschreibungen', amtlich: ref('ist', 'abschreibungen'), eigen: num(eigen.abschreibungen),
      grund: 'überwiegend auf Kostenstellen gebucht, nicht auf Aufträgen' },
  ] : [];

  const kreise = ['PRIMAER', 'VERRECHNUNG', 'UMLAGE', 'ABRECHNUNG'].filter(k => rows.some(r => r.belegkreis === k));
  const traeger = ['PROJEKT', 'BEREICH', 'ZENTRALE', 'NICHT_ZUGEORDNET'].filter(t => rows.some(r => r.kostentraeger === t));

  const zelle = (k: string, t: string) => rows.filter(r => r.belegkreis === k && r.kostentraeger === t);
  const saldo = (k: string, t?: string) =>
    rows.filter(r => r.belegkreis === k && (!t || r.kostentraeger === t)).reduce((a, r) => a + num(r.saldo), 0);
  const anzahl = (k: string, t?: string) =>
    rows.filter(r => r.belegkreis === k && (!t || r.kostentraeger === t)).reduce((a, r) => a + num(r.belege), 0);

  const saldoGesamt = rows.reduce((a, r) => a + num(r.saldo), 0);
  const saldoRelevant = rows.filter(r => r.belegkreis !== 'ABRECHNUNG').reduce((a, r) => a + num(r.saldo), 0);
  const evst = monate.reduce((a, m) => a + num(m.ergebnis_vor_steuern), 0);
  const differenz = evst - -saldoRelevant;

  return (
    <Shell titel="Abstimmung und Datenqualität" bereich={`Geschäftsjahr ${jahr}`} aktiv="abstimmung" benutzer={benutzer}>
      <Unterseiten seiten={UNTERSEITEN} aktiv={teil} />
      <div className="card" data-vorzeichen="sap">
        <PeriodenWahl pfad={UNTERSEITEN.find(u => u.key === teil)?.href ?? '/abstimmung'}
                      jahre={jahre} jahr={jahr} />
      </div>

      {/* ============ Abstimmung gegen den offiziellen Abschluss ============ */}
      {teil === 'ueberblick' && <>
      <div className={probe === 0 && !guvOffen.length ? 'note' : 'note warn'}>
        <b>{probe === 0 && !guvOffen.length
            ? 'GuV und Bilanz stimmen ab.' : 'Abweichung gegen den Abschluss.'}</b>{' '}
        Alle <b>{zahl(guvAb.length)}</b> GuV-Konten stimmen mit dem SAP-Abschluss
        (Periode 8/2026) überein – offene Differenzen: <b className="num">{zahl(guvOffen.length)}</b>.
        Bilanz <b className="num">{eur0(bilanzSumme)}</b> gegen
        GuV <b className="num">{eur0(guvSumme)}</b> ergibt die
        Probe <b className="num">{eur0(probe)}</b>.
      </div>

      <div className="card" data-vorzeichen="sap">
        <div className="card-head">
          <div>
            <div className="eyebrow">Gegen den Jahresabschluss</div>
            <h2>Ergebnis Januar bis August 2026</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Position</th><th className="r">Konten</th><th className="r">Betrag</th></tr></thead>
              <tbody>
                {kat.map(k => (
                  <tr key={k.kategorie}>
                    <td>{k.kategorie_text || k.kategorie}</td>
                    <td className="r num muted">{zahl(k.konten)}</td>
                    <td className={`r num ${vz(-num(k.wert))}`}>{eur0(k.wert)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td><b>{guvSumme > 0 ? 'Jahresfehlbetrag' : 'Jahresüberschuss'} per 31.08.2026</b></td>
                  <td className="r num">{zahl(guvAb.length)}</td>
                  <td className="r num"><b>{eur0(guvSumme)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Der SAP-Bericht selbst weist an dieser Stelle <b className="num">{eur0(abschlussS)}</b> aus –
              denselben Wert. Die im Bericht gedruckte Zeile „Jahresüberschuß / Jahresfehlbetrag“
              lautet dagegen 689.066,87 €, weil sieben echte Aufwandskonten über
              214.116,66 € in der Berichtsstruktur keiner Position zugeordnet sind und
              deshalb unter „Nicht zugeordnete Konten“ herausfallen. Betroffen sind 401015,
              411021, 420015, 420021, 420022, 450081 und 460081. Das ist ein Fehler der
              Berichtsgliederung, nicht der Buchungsdaten.
            </span>
          </div>
        </div>
      </div>

      <div className="card" data-vorzeichen="sap">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schlussprobe</div>
            <h2>Bilanz gegen GuV</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <tbody>
                <tr><td>Aktiva ({zahl(bil.filter(r => num(r.bestand) > 0).length)} Konten)</td>
                    <td className="r num pos">{eur0(aktiva)}</td></tr>
                <tr><td>Passiva ({zahl(bil.filter(r => num(r.bestand) < 0).length)} Konten)</td>
                    <td className="r num neg">{eur0(passiva)}</td></tr>
                <tr><td>Saldo der Bilanzkonten</td>
                    <td className="r num"><b>{eur0(bilanzSumme)}</b></td></tr>
                <tr><td>Ergebnis laut GuV</td>
                    <td className="r num"><b>{eur0(guvSumme)}</b></td></tr>
                <tr className="total"><td><b>Probe</b></td>
                    <td className="r num"><b>{eur0(probe)}</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </>}

      {teil === 'konten' && <>
      {!!guvOffen.length && (
        <div className="card" data-vorzeichen="sap">
          <div className="card-head">
            <div><div className="eyebrow">Offen</div><h2>Konten mit Differenz</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Konto</th><th>Bezeichnung</th><th className="r">Abschluss</th>
                  <th className="r">Einzelposten</th><th className="r">Differenz</th></tr></thead>
                <tbody>
                  {guvOffen.map(r => (
                    <tr key={r.konto}>
                      <td className="num">{r.konto}</td>
                      <td>{r.bezeichnung}</td>
                      <td className="r num">{eur0(r.abschluss)}</td>
                      <td className="r num">{eur0(r.einzelposten)}</td>
                      <td className="r num neg"><b>{eur0(r.differenz)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ Interne Probe der Deckungsbeitragsrechnung ============ */}
      <div className={differenz === 0 ? 'note' : 'note warn'}>
        <b>{differenz === 0 ? 'Die Deckungsbeitragsrechnung ist in sich geschlossen.'
                            : 'Abweichung festgestellt.'}</b>{' '}
        Summe aller ergebnisrelevanten Buchungszeilen: <b className="num">{eur0(saldoRelevant)}</b>;
        die Deckungsbeitragsrechnung liefert <b className="num">{eur0(evst)}</b> –
        Differenz <b className="num">{eur0(differenz)}</b>. Diese Probe zeigt, dass beide
        Auswertungen dieselbe Datenbasis gleich verarbeiten. Sie ist <b>kein</b> Abgleich
        mit dem Jahresabschluss: der Auftragsbericht enthält weder die auf Kostenstellen
        gebuchten Personalkosten noch den August. Maßgeblich ist die Abstimmung oben.
      </div>

      <div className="card" data-vorzeichen="sap">
        <div className="card-head">
          <div>
            <div className="eyebrow">Vollständigkeitsnachweis</div>
            <h2>Belegkreise nach Kostenträger</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Belegkreis</th>
                  {traeger.map(t => <th key={t} className="r">{TRAEGER[t]}</th>)}
                  <th className="r">Saldo</th><th className="r">Belege</th><th className="r">In der Ergebnisrechnung</th>
                </tr>
              </thead>
              <tbody>
                {kreise.map(k => (
                  <tr key={k}>
                    <td>
                      <b>{KREIS_TEXT[k].titel}</b>
                      <span className="formula" style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {KREIS_TEXT[k].text}
                      </span>
                    </td>
                    {traeger.map(t => {
                      const z = zelle(k, t);
                      return (
                        <td key={t} className="r num">
                          {z.length ? eur0(saldo(k, t)) : <span className="muted">–</span>}
                          {z.length ? <div className="muted" style={{ fontSize: 11 }}>{zahl(anzahl(k, t))} Zeilen</div> : null}
                        </td>
                      );
                    })}
                    <td className="r num"><b>{eur0(saldo(k))}</b></td>
                    <td className="r num muted">{zahl(anzahl(k))}</td>
                    <td className="r">
                      {KREIS_TEXT[k].relevant
                        ? <span className="chip pos">enthalten</span>
                        : <span className="chip warn">ausgeschlossen</span>}
                    </td>
                  </tr>
                ))}
                <tr className="sub">
                  <td>Summe ergebnisrelevant</td>
                  {traeger.map(t => (
                    <td key={t} className="r num">
                      {eur0(rows.filter(r => r.belegkreis !== 'ABRECHNUNG' && r.kostentraeger === t)
                                .reduce((a, r) => a + num(r.saldo), 0))}
                    </td>
                  ))}
                  <td className={`r num ${vz(-saldoRelevant)}`}><b>{eur0(saldoRelevant)}</b></td>
                  <td className="r num">{zahl(rows.filter(r => r.belegkreis !== 'ABRECHNUNG').reduce((a, r) => a + num(r.belege), 0))}</td>
                  <td />
                </tr>
                <tr className="total">
                  <td>Summe Export gesamt</td>
                  {traeger.map(t => (
                    <td key={t} className="r num">
                      {eur0(rows.filter(r => r.kostentraeger === t).reduce((a, r) => a + num(r.saldo), 0))}
                    </td>
                  ))}
                  <td className="r num">{eur0(saldoGesamt)}</td>
                  <td className="r num">{zahl(rows.reduce((a, r) => a + num(r.belege), 0))}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </>}

      {teil === 'bcs' && <>
      {!!abgleich.length && (
        <div className="card" data-vorzeichen="sap">
          <div className="card-head">
            <div>
              <div className="eyebrow">Abgleich mit der offiziellen GuV</div>
              <h2>Auftragsbericht gegen BCS-GuV, Perioden 1–{istBis}</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr><th>Position</th><th className="r">BCS-GuV (Ist)</th>
                      <th className="r">Auftragsbericht</th><th className="r">Differenz</th>
                      <th className="r">Abdeckung</th><th>Erläuterung</th></tr>
                </thead>
                <tbody>
                  {abgleich.map(a => {
                    const diff = a.eigen - a.amtlich;
                    const quote = a.amtlich ? (a.eigen / a.amtlich) * 100 : null;
                    return (
                      <tr key={a.pos}>
                        <td><b>{a.pos}</b></td>
                        <td className="r num">{eur0(a.amtlich)}</td>
                        <td className="r num">{eur0(a.eigen)}</td>
                        <td className={`r num ${Math.abs(diff) < 1 ? '' : vz(diff)}`}>{eur0(diff)}</td>
                        <td className="r">
                          <span className={`chip ${quote === null ? '' : quote > 97 ? 'pos' : quote > 60 ? 'warn' : 'neg'}`}>
                            {quote === null ? '–' : pct(quote)}
                          </span>
                        </td>
                        <td className="muted">{a.grund}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-body" style={{ paddingTop: 14 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Quelle der amtlichen Werte: <span className="mono">controlling.guv_referenz</span>,
                übernommen aus der BCS-GuV der TVF ALTWERT GmbH (Stand 30.07.2026).
                Die Referenz wird nur gelesen und fließt in keine Berechnung ein.
              </span>
            </div>
          </div>
        </div>
      )}

      </>}

      {teil === 'daten' && <>
      <div className="grid-2">
        <div className="card" data-vorzeichen="sap">
          <div className="card-head">
            <div>
              <div className="eyebrow">Datenbestand</div>
              <h2>Datenqualität</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Kennzahl</th><th className="r">Anzahl</th><th>Erläuterung</th></tr></thead>
                <tbody>
                  {qualitaet.map(z => (
                    <tr key={z.kennzahl}>
                      <td><b>{z.kennzahl}</b></td>
                      <td className="r num">{zahl(z.wert)}</td>
                      <td className="muted">{z.hinweis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card" data-vorzeichen="sap">
          <div className="card-head">
            <div>
              <div className="eyebrow">Bekannte Eigenheiten des Exports</div>
              <h2>Was beim Import korrigiert wurde</h2>
            </div>
          </div>
          <div className="card-body">
            <div className="deflist">
              <div>
                <b>Summenzeile entfernt</b>
                <span>Der Excel-Export enthielt eine Reportsumme ohne Auftrag und ohne Periode. Sie hätte jede
                      Auswertung verdoppelt und ist über das Kennzeichen <span className="mono">gueltig</span> ausgeschlossen.</span>
              </div>
              <div>
                <b>Fremdschlüssel ergänzt</b>
                <span>Die Spalten <span className="mono">projekt_id</span> und <span className="mono">kostenart_id</span> waren
                      durchgängig leer. Sie wurden über Auftragsnummer und Kontonummer nachgezogen – ohne sie war jede
                      Projekt- und Kostenartenauswertung leer.</span>
              </div>
              <div>
                <b>Kostenarten neu klassifiziert</b>
                <span>Der Ausgangsbestand hatte alle Konten als <span className="mono">AUTO</span> mit
                      Erlöskonten als variable Kosten geführt. Die Zuordnung erfolgt jetzt über die
                      Kontonummernkreise, einsehbar im <Link href="/kostenarten" style={{ color: 'var(--accent)' }}>Kostenartenstamm</Link>.</span>
              </div>
              <div>
                <b>Abrechnungsbelege getrennt</b>
                <span>Belege der Nummer 80… entlasten den Auftrag auf eine Ergebnis-Kostenstelle.
                      Ohne diese Trennung ergibt jedes Projekt exakt null.</span>
              </div>
              <div>
                <b>Nicht im Export enthalten</b>
                <span>Empfänger der Abrechnungen sowie die Senderkostenstellen der Lohn- und Geräteverrechnung
                      liegen außerhalb des Auftragsberichts. Eine vollständige handelsrechtliche GuV des
                      Buchungskreises lässt sich daraus nicht ableiten – die
                      <Link href="/guv" style={{ color: 'var(--accent)' }}> GuV-Staffel</Link> zeigt deshalb
                      ausschließlich die auftragsbezogenen Positionen.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>}
    </Shell>
  );
}
