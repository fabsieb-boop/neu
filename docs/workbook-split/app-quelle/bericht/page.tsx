import Link from 'next/link';
import Shell from '../components/Shell';
import Unterseiten from '../components/Unterseiten';
import { UNTERSEITEN } from './unterseiten';
import Drucken from './Drucken';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import {
  geschaeftsjahre, dbMonate, dbRegionen, projektErgebnisse, liqGrunddaten, guvReferenz,
  liqWochen, liqTageMonate, liqTagStand, guvRegionStaffel,
} from '@/lib/queries';
import { pool } from '@/lib/db';
import { rechne, kalibriere, reichweite } from '@/lib/liquiditaet';
import {
  eur0, eurKurz, pct, anteil, vz, zahl, datum, monat as monatName, monatKurz, num,
} from '@/lib/format';
import { SaeulenChart, LinienChart, RangChart, RingChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

const BERICHTE = [
  { key: 'forecast',    titel: 'Forecast-Bericht',     zweck: 'Abrechnungsstand je Projekt und Ergebnisrechnung je Region' },
  { key: 'liquiditaet', titel: 'Liquiditätsbericht',   zweck: 'Zahlungsplan, Reichweite und Szenarien' },
  { key: 'rentabilitaet', titel: 'Rentabilitätsbericht', zweck: 'Margen, Kostenstruktur und Kapitalbindung' },
] as const;

type BerichtTyp = typeof BERICHTE[number]['key'];

export default async function BerichtSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('bericht.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || 2026;
  const typ: BerichtTyp = (BERICHTE.some(b => b.key === sp.typ) ? sp.typ : 'forecast') as BerichtTyp;
  /* Der Bericht wird gedruckt und weitergereicht – hier darf keine
     fremde Region durchrutschen. Ist der Benutzer eingeschraenkt und
     waehlt nichts, wird seine erste Region gesetzt statt "alle". */
  const roheRegion = sp.region || '';

  const [monate, regionenRoh, projekteRoh, referenz] = await Promise.all([
    dbMonate(jahr), dbRegionen(jahr),
    projektErgebnisse(jahr, roheRegion || undefined), guvReferenz(jahr),
  ]);

  /* Nur freigegebene Regionen stehen zur Auswahl und in den Tabellen.
     Keine Auswahl bleibt keine Auswahl: "alle Regionen" ist eine gueltige
     Wahl und keine unzulaessige.  Vorher wurde daraus die erste Region –
     wer den Bericht ueber alle Regionen wollte, landete jedes Mal wieder
     bei West. */
  const alleRegionen = nurErlaubteRegionen(regionenRoh, benutzer);
  const region = regionErzwingen(benutzer, roheRegion);
  const projekte = nurErlaubteRegionen(projekteRoh, benutzer);

  /* Wird eine Region gewählt, zeigt der Bericht auch nur diese – vorher
     filterte die Auswahl nur die Projektliste, die Regionstabelle lief
     ungefiltert weiter. */
  const regionen = region
    ? alleRegionen.filter(r => r.regionscode === region)
    : alleRegionen;

  const istBis = monate.length ? Math.max(...monate.map(m => m.monat)) : 0;
  const s = <T,>(rows: T[], f: (r: T) => unknown) => rows.reduce((a, r) => a + num(f(r)), 0);

  const leistung = s(monate, m => m.leistung);
  const db1 = s(monate, m => m.db1);
  const db3 = s(monate, m => m.db3);
  const db4 = s(monate, m => m.db4);
  const evst = s(monate, m => m.ergebnis_vor_steuern);

  const referenzwert = (sz: string, pos: string) =>
    num(referenz.find(r => r.szenario === sz && r.position === pos)?.betrag);

  const bericht = BERICHTE.find(b => b.key === typ)!;

  /* ---------------------------------------------------------------- Berichtskopf
     Firmenangaben aus app_einstellung, Logo und Anschrift aus der gewaehlten
     Region. Ohne Regionsauswahl gilt der Firmeneintrag unter der Region '*'. */
  const regionsname = region
    ? alleRegionen.find(r => r.regionscode === region)?.region ?? ''
    : '';

  const [einst, regDaten] = await Promise.all([
    pool.query(`SELECT schluessel, wert FROM controlling.app_einstellung`),
    regionsname
      ? pool.query(`SELECT langname, anschrift, leitung, farbe, (logo IS NOT NULL) AS hat_logo
                      FROM controlling.region_einstellung WHERE region = $1`, [regionsname])
      : pool.query(`SELECT NULL::text AS langname, NULL::text AS anschrift, NULL::text AS leitung,
                           NULL::text AS farbe, false AS hat_logo WHERE false`),
  ]);
  const e = (k: string) => einst.rows.find((x: any) => x.schluessel === k)?.wert ?? '';
  const rd = regDaten.rows[0];
  const hatFirmenlogo = (await pool.query(
    `SELECT 1 FROM controlling.region_einstellung WHERE region = '*' AND logo IS NOT NULL`)).rows.length > 0;

  const kopf = {
    firma: [e('firma_name'), e('firma_zusatz')].filter(Boolean).join(' · '),
    untertitel: e('bericht_untertitel'),
    datumZeigen: e('bericht_datum_zeigen') !== 'nein',
    regionsname: regionsname ? (rd?.langname || `Region ${regionsname}`) : 'alle Regionen',
    anschrift: rd?.anschrift ?? '',
    leitung: rd?.leitung ? `Regionalleitung ${rd.leitung}` : '',
    farbe: rd?.farbe ?? '',
    logoQuelle: regionsname
      ? `/api/logo/${encodeURIComponent(regionsname)}`
      : (hatFirmenlogo ? `/api/logo/${encodeURIComponent('*')}` : ''),
    logoAlt: regionsname ? `Logo ${regionsname}` : e('firma_name') || 'Firmenlogo',
  };

  return (
    <Shell titel="Berichtsgenerator" bereich={`Geschäftsjahr ${jahr}`} aktiv="bericht" benutzer={benutzer}>
      <Unterseiten seiten={UNTERSEITEN} aktiv="feste" />
      <form className="druckleiste" method="get" action="/bericht">
        <div className="field">
          <label htmlFor="typ">Bericht</label>
          <select id="typ" name="typ" defaultValue={typ} style={{ minWidth: 220 }}>
            {BERICHTE.map(b => <option key={b.key} value={b.key}>{b.titel}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="jahr">Geschäftsjahr</label>
          <select id="jahr" name="jahr" defaultValue={String(jahr)}>
            {jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="region">Region</label>
          <select id="region" name="region" defaultValue={region}>
            <option value="">alle Regionen</option>
            {alleRegionen.map(r => <option key={r.regionscode} value={r.regionscode}>{r.region}</option>)}
          </select>
        </div>
        <button className="btn primary" type="submit">Bericht erzeugen</button>
        <Drucken />
        <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto' }}>{bericht.zweck}</span>
      </form>

      <div className="card bericht" style={kopf.farbe ? { ['--bericht-akzent' as string]: kopf.farbe } : undefined}>
        <div className="bericht-kopf">
          <div className="bericht-marke">
            {kopf.logoQuelle && (
              /* Region gewaehlt -> deren Logo, sonst das Firmenlogo. Der
                 Zeitstempel umgeht den Zwischenspeicher nach einem Wechsel. */
              <img className="bericht-logo" src={kopf.logoQuelle} alt={kopf.logoAlt} />
            )}
            <div>
              <div className="firma">{kopf.firma}</div>
              <h1>{bericht.titel} {jahr}</h1>
              {kopf.untertitel && <div className="untertitel">{kopf.untertitel}</div>}
            </div>
          </div>
          <div className="stand">
            Datenstand: {istBis ? `${monatName(istBis)} ${jahr}` : '–'}<br />
            {kopf.regionsname}<br />
            {kopf.anschrift && <>{kopf.anschrift}<br /></>}
            {kopf.leitung && <>{kopf.leitung}<br /></>}
            {kopf.datumZeigen && <>erstellt {datum(new Date())}</>}
          </div>
        </div>

        {typ === 'forecast' && (
          <ForecastBericht
            jahr={jahr} istBis={istBis} monate={monate} regionen={regionen}
            projekte={projekte} referenzwert={referenzwert} leistung={leistung} db1={db1} db3={db3} db4={db4} evst={evst}
          />
        )}

        {typ === 'liquiditaet' && <LiquiditaetsBericht jahr={jahr} />}

        {typ === 'rentabilitaet' && (
          <RentabilitaetsBericht
            jahr={jahr} monate={monate} regionen={regionen} projekte={projekte}
            leistung={leistung} db1={db1} db3={db3} db4={db4} evst={evst}
          />
        )}

        <div className="bericht-fuss">
          <b>Herkunft der Zahlen.</b> Sämtliche Werte sind aus den Buchungszeilen gerechnet
          (<span className="mono">controlling.v_buchung</span>); Abrechnungsbelege bleiben ausgeschlossen.
          Der vollständige Rechenweg steht in der Anwendung unter <i>Rechenwege</i>, der
          Vollständigkeitsnachweis unter <i>Abstimmung</i>.<br />
          <b>Grenzen.</b> Der Auftragsbericht enthält keine Kostenstellenbuchungen. Personalaufwand und
          Abschreibungen sind darin nur teilweise enthalten; die Abweichung zur handelsrechtlichen GuV
          ist unter <i>Abstimmung</i> beziffert.
        </div>
      </div>
    </Shell>
  );
}

/* ====================================================== Forecast-Bericht */

function ForecastBericht({ jahr, istBis, monate, regionen, projekte, referenzwert, leistung, db1, db3, db4, evst }: any) {
  const jahrUmsatz = referenzwert('jahr', 'umsatz');
  const istUmsatz = referenzwert('ist', 'umsatz');
  const abrechnungsstand = jahrUmsatz ? (istUmsatz / jahrUmsatz) * 100 : null;

  const mitLeistung = projekte.filter((p: any) => num(p.leistung) !== 0);
  const maxLeistung = Math.max(...mitLeistung.map((p: any) => Math.abs(num(p.leistung))), 1);

  return (
    <>
      <div className="bericht-teil">
        <h2><span className="nr">Teil 1</span> Abrechnungsstand</h2>

        <div className="bericht-kennzahlen">
          <div>
            <div className="k">Umsatz Ist</div>
            <div className="w num">{eurKurz(istUmsatz)}</div>
            <div className="h">Januar bis {monatName(istBis)}</div>
          </div>
          <div>
            <div className="k">Umsatz Jahresplanung</div>
            <div className="w num">{eurKurz(jahrUmsatz)}</div>
            <div className="h">BCS-Planung</div>
          </div>
          <div>
            <div className="k">Abrechnungsstand</div>
            <div className="w num">{abrechnungsstand === null ? '–' : pct(abrechnungsstand)}</div>
            <div className="h">Ist ÷ Jahresplanung</div>
          </div>
          <div>
            <div className="k">Noch offen</div>
            <div className="w num">{eurKurz(jahrUmsatz - istUmsatz)}</div>
            <div className="h">bis Jahresende</div>
          </div>
          <div>
            <div className="k">Projekte mit Leistung</div>
            <div className="w num">{mitLeistung.length}</div>
            <div className="h">von {projekte.length} im Bestand</div>
          </div>
        </div>

        <div className="tablewrap">
          <table className="data compact">
            <thead>
              <tr>
                <th>Projekt</th><th>Region</th>
                <th className="r">Leistung Ist</th><th className="r">Anteil</th>
                <th className="r">DB I</th><th className="r">DB I-Marge</th>
                <th className="r">DB III</th><th className="r">DB III-Marge</th>
                <th className="r">Letzte Buchung</th>
              </tr>
            </thead>
            <tbody>
              {mitLeistung.slice(0, 40).map((p: any) => (
                <tr key={p.projekt_nr}>
                  <td><b>{p.projektname || p.projekt_nr}</b><div className="muted mono">{p.projekt_nr}</div></td>
                  <td className="muted">{p.region}</td>
                  <td className="r num">{eur0(p.leistung)}</td>
                  <td className="r num muted">{pct((num(p.leistung) / maxLeistung) * 0 + (num(p.leistung) / Math.max(1, leistung)) * 100)}</td>
                  <td className={`r num ${vz(p.db1)}`}>{eur0(p.db1)}</td>
                  <td className="r num muted">{p.db1_marge === null ? '–' : pct(p.db1_marge)}</td>
                  <td className={`r num ${vz(p.db3)}`}>{eur0(p.db3)}</td>
                  <td className="r num muted">{p.db3_marge === null ? '–' : pct(p.db3_marge)}</td>
                  <td className="r muted">{datum(p.letzte_buchung)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Summe {mitLeistung.length} Projekte</td>
                <td className="r num">{eur0(leistung)}</td>
                <td className="r num">100,0 %</td>
                <td className={`r num ${vz(db1)}`}>{eur0(db1)}</td>
                <td className="r num">{pct(anteil(db1, leistung) ?? 0)}</td>
                <td className={`r num ${vz(db3)}`}>{eur0(db3)}</td>
                <td className="r num">{pct(anteil(db3, leistung) ?? 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {mitLeistung.length > 40 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Es werden die 40 leistungsstärksten Projekte gezeigt; die Summenzeile umfasst alle {mitLeistung.length}.
          </p>
        )}
      </div>

      {/* Ein Bericht, der nur aus Tabellen besteht, wird nicht gelesen, sondern
          ueberflogen.  Ein Bild je Teil zeigt die Aussage, die Tabelle darunter
          belegt sie. */}
      {!!regionen.length && (
        <div className="bericht-teil">
          <h2><span className="nr">Bild zu Teil 2</span> Ergebnis je Region</h2>
          <RangChart zeilen={[...regionen]
            .sort((a: any, b: any) => num(b.db4) - num(a.db4))
            .map((r: any) => ({ label: r.region, wert: num(r.db4),
                                hinweis: `Leistung ${eurKurz(r.leistung)}` }))} />
        </div>
      )}

      <div className="bericht-teil">
        <h2><span className="nr">Teil 2</span> Ergebnisrechnung je Region</h2>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Region</th><th className="r">Projekte</th><th className="r">Leistung</th>
                <th className="r">var. EK</th><th className="r">DB I</th><th className="r">Marge</th>
                <th className="r">Proj.-Fix</th><th className="r">GK-Umlage</th>
                <th className="r">DB III</th><th className="r">Deckungsdiff.</th><th className="r">DB IV</th>
              </tr>
            </thead>
            <tbody>
              {regionen.map((r: any) => (
                <tr key={r.regionscode}>
                  <td><b>{r.region}</b></td>
                  <td className="r num">{r.projekte}</td>
                  <td className="r num">{eur0(r.leistung)}</td>
                  <td className="r num">{eur0(r.variable_kosten)}</td>
                  <td className={`r num ${vz(r.db1)}`}>{eur0(r.db1)}</td>
                  <td className="r num muted">{num(r.leistung) ? pct(anteil(r.db1, r.leistung) ?? 0) : '–'}</td>
                  <td className="r num">{eur0(r.fixe_projektkosten)}</td>
                  <td className="r num">{eur0(r.verrechnete_gk)}</td>
                  <td className={`r num ${vz(r.db3)}`}>{eur0(r.db3)}</td>
                  <td className="r num">{eur0(r.bereichs_deckungsdifferenz)}</td>
                  <td className={`r num ${vz(r.db4)}`}><b>{eur0(r.db4)}</b></td>
                </tr>
              ))}
              <tr className="result">
                <td>Unternehmen</td>
                <td className="r num">{s(regionen, (r: any) => r.projekte)}</td>
                <td className="r num">{eur0(leistung)}</td>
                <td className="r num">{eur0(s(regionen, (r: any) => r.variable_kosten))}</td>
                <td className="r num">{eur0(db1)}</td>
                <td className="r num">{pct(anteil(db1, leistung) ?? 0)}</td>
                <td className="r num">{eur0(s(regionen, (r: any) => r.fixe_projektkosten))}</td>
                <td className="r num">{eur0(s(regionen, (r: any) => r.verrechnete_gk))}</td>
                <td className="r num">{eur0(db3)}</td>
                <td className="r num">{eur0(s(regionen, (r: any) => r.bereichs_deckungsdifferenz))}</td>
                <td className="r num"><b>{eur0(db4)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!!monate.length && (() => {
        const mListe = monate.map((m: any) => num(m.monat));
        let lauf = 0;
        const kum = monate.map((m: any) => (lauf += num(m.ergebnis_vor_steuern)));
        return (
          <div className="bericht-teil">
            <h2><span className="nr">Bild zu Teil 3</span> Verlauf über das Jahr</h2>
            <SaeulenChart monate={mListe} hoehe={220} serien={[
              { label: 'Leistung', farbe: '#2563eb', werte: monate.map((m: any) => num(m.leistung)) },
              { label: 'DB I', farbe: '#0d9488', werte: monate.map((m: any) => num(m.db1)) },
            ]} />
            <div className="legend">
              <span><i style={{ background: '#2563eb' }} />Leistung</span>
              <span><i style={{ background: '#0d9488' }} />DB I</span>
            </div>
            <LinienChart monate={mListe} hoehe={200} abNull serien={[
              { label: 'Ergebnis im Monat', farbe: '#b45309',
                werte: monate.map((m: any) => num(m.ergebnis_vor_steuern)) },
              { label: 'aufgelaufen', farbe: '#0f172a', werte: kum },
            ]} />
            <div className="legend">
              <span><i style={{ background: '#b45309' }} />Ergebnis im Monat</span>
              <span><i style={{ background: '#0f172a' }} />aufgelaufen</span>
            </div>
          </div>
        );
      })()}

      <div className="bericht-teil">
        <h2><span className="nr">Teil 3</span> Monatsverlauf</h2>
        <div className="tablewrap">
          <table className="data compact">
            <thead>
              <tr>
                <th>Periode</th><th className="r">Leistung</th><th className="r">DB I</th>
                <th className="r">DB II</th><th className="r">DB III</th><th className="r">DB IV</th>
                <th className="r">neutral</th><th className="r">Auftragsergebnis</th>
              </tr>
            </thead>
            <tbody>
              {monate.map((m: any) => (
                <tr key={m.monat}>
                  <td><b>{monatName(m.monat)}</b></td>
                  <td className="r num">{eur0(m.leistung)}</td>
                  <td className={`r num ${vz(m.db1)}`}>{eur0(m.db1)}</td>
                  <td className={`r num ${vz(m.db2)}`}>{eur0(m.db2)}</td>
                  <td className={`r num ${vz(m.db3)}`}>{eur0(m.db3)}</td>
                  <td className={`r num ${vz(m.db4)}`}>{eur0(m.db4)}</td>
                  <td className="r num muted">{eur0(m.neutrales_ergebnis)}</td>
                  <td className={`r num ${vz(m.ergebnis_vor_steuern)}`}><b>{eur0(m.ergebnis_vor_steuern)}</b></td>
                </tr>
              ))}
              <tr className="total">
                <td>Summe</td>
                <td className="r num">{eur0(leistung)}</td>
                <td className="r num">{eur0(db1)}</td>
                <td className="r num">{eur0(s(monate, (m: any) => m.db2))}</td>
                <td className="r num">{eur0(db3)}</td>
                <td className="r num">{eur0(db4)}</td>
                <td className="r num">{eur0(s(monate, (m: any) => m.neutrales_ergebnis))}</td>
                <td className="r num"><b>{eur0(evst)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ================================================== Liquiditätsbericht */

/**
 * Wochen- und Monatssicht aus dem tagesgenauen Zahlungsplan der
 * Wochenmappe. Anders als das Monatsmodell zeigt sie den Tiefpunkt
 * innerhalb einer Woche – dort entscheidet sich, ob die Linie reicht.
 */
async function LiquiditaetWochen() {
  const [wochen, monate, stand] = await Promise.all([
    liqWochen(), liqTageMonate(), liqTagStand(),
  ]);
  if (!wochen.length) return null;

  const s = stand[0];
  const tiefste = wochen.reduce((a, w) =>
    num(w.saldo_tiefpunkt) < num(a.saldo_tiefpunkt) ? w : a, wochen[0]);

  return (
    <div className="bericht-teil">
      <h2><span className="nr">Teil 4</span> Zahlungsplan nach Kalenderwochen</h2>

      <div className="bericht-kennzahlen">
        <div><div className="k">Tiefster Punkt</div>
          <div className="w num">{eurKurz(tiefste.saldo_tiefpunkt)}</div>
          <div className="h">KW {tiefste.kalenderwoche} · {datum(tiefste.tiefpunkt_am)}</div></div>
        <div><div className="k">Stand am Ende</div>
          <div className="w num">{eurKurz(wochen[wochen.length - 1].saldo_ende)}</div>
          <div className="h">{datum(wochen[wochen.length - 1].bis)}</div></div>
        <div><div className="k">Eingänge</div>
          <div className="w num">{eurKurz(wochen.reduce((a, w) => a + num(w.eingang), 0))}</div>
          <div className="h">über {wochen.length} Wochen</div></div>
        <div><div className="k">Ausgänge</div>
          <div className="w num">{eurKurz(wochen.reduce((a, w) => a + num(w.ausgang), 0))}</div>
          <div className="h">über {wochen.length} Wochen</div></div>
      </div>

      <table className="data compact">
        <thead>
          <tr><th>KW</th><th>Zeitraum</th><th className="r">Eingang</th><th className="r">Ausgang</th>
              <th className="r">Netto</th><th className="r">Tiefpunkt</th><th>am</th>
              <th className="r">Stand Ende</th></tr>
        </thead>
        <tbody>
          {wochen.map(w => (
            <tr key={`${w.iso_jahr}-${w.kalenderwoche}`}
                className={w === tiefste ? 'warn' : undefined}>
              <td><b>KW {w.kalenderwoche}</b></td>
              <td className="muted">{datum(w.von)} – {datum(w.bis)}</td>
              <td className="r num pos">{eur0(w.eingang)}</td>
              <td className="r num neg">{eur0(w.ausgang)}</td>
              <td className={`r num ${vz(num(w.veraenderung))}`}>{eur0(w.veraenderung)}</td>
              <td className={`r num ${vz(num(w.saldo_tiefpunkt))}`}><b>{eur0(w.saldo_tiefpunkt)}</b></td>
              <td className="muted">{datum(w.tiefpunkt_am)}</td>
              <td className={`r num ${vz(num(w.saldo_ende))}`}>{eur0(w.saldo_ende)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 22 }}>Dieselbe Reihe auf Monate verdichtet</h3>
      <table className="data compact">
        <thead>
          <tr><th>Monat</th><th className="r">Tage</th><th className="r">Eingang</th>
              <th className="r">Ausgang</th><th className="r">Netto</th>
              <th className="r">Tiefpunkt</th><th>am</th><th className="r">Stand Ende</th></tr>
        </thead>
        <tbody>
          {monate.map(m => (
            <tr key={`${m.jahr}-${m.monat}`}>
              <td><b>{monatName(m.monat)} {m.jahr}</b></td>
              <td className="r num muted">{m.tage}</td>
              <td className="r num pos">{eur0(m.eingang)}</td>
              <td className="r num neg">{eur0(m.ausgang)}</td>
              <td className={`r num ${vz(num(m.veraenderung))}`}>{eur0(m.veraenderung)}</td>
              <td className={`r num ${vz(num(m.saldo_tiefpunkt))}`}><b>{eur0(m.saldo_tiefpunkt)}</b></td>
              <td className="muted">{datum(m.tiefpunkt_am)}</td>
              <td className={`r num ${vz(num(m.saldo_ende))}`}>{eur0(m.saldo_ende)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="quelle" style={{ marginTop: 10 }}>
        Der Monat zeigt hier nur die Tage, die die Wochenmappe abdeckt – deshalb
        weichen die Randmonate von der Monatsplanung in Teil 1 ab. Beide Reihen
        stammen aus verschiedenen Quellen und sind bewusst nicht ineinander
        gerechnet.
      </p>
    </div>
  );
}

async function LiquiditaetsBericht({ jahr }: { jahr: number }) {
  const g = await liqGrunddaten(jahr);
  if (!g.monate.length) {
    return (
      <div className="bericht-teil">
        <div className="note warn" style={{ marginBottom: 0 }}>
          Für {jahr} sind keine Liquiditätsdaten hinterlegt.
        </div>
      </div>
    );
  }

  const kal = kalibriere(g.monate, g.parameter, g.bestaende, g.finanzierung);
  const plan = rechne(g.monate, g.parameter, g.bestaende, g.finanzierung);
  const rw = reichweite(plan);
  const planmonate = plan.filter(z => !z.ist);
  const sp = (f: (z: typeof planmonate[number]) => number) => planmonate.reduce((a, z) => a + f(z), 0);

  const szenarien = [
    { name: 'Basis', opt: {} },
    { name: 'Konservativ', opt: { dso: g.parameter.dso_tage + 15, realisierungsquote: 0.8 } },
    { name: 'Stress', opt: { dso: g.parameter.dso_tage + 30, realisierungsquote: 0.6, systematischerZufluss: 0 } },
    { name: 'Ohne Anzahlungszufluss', opt: { realisierungsquote: 0 } },
  ].map(sz => {
    const p = rechne(g.monate, g.parameter, g.bestaende, g.finanzierung, sz.opt).filter(z => !z.ist);
    return { ...sz, zeilen: p, ende: p[p.length - 1]?.bestand ?? 0 };
  });

  return (
    <>
      <div className="bericht-teil">
        <h2><span className="nr">Teil 1</span> Lage</h2>
        <div className="bericht-kennzahlen">
          <div><div className="k">Bestand Jahresende</div><div className="w num">{eurKurz(rw?.bestandEnde)}</div>
            <div className="h">nach {planmonate.length} Planmonaten</div></div>
          <div><div className="k">Tiefpunkt</div><div className="w num">{eurKurz(rw?.tiefpunkt.bestand)}</div>
            <div className="h">{monatName(rw?.tiefpunkt.monat)}</div></div>
          <div><div className="k">Netto-Cashflow</div><div className="w num">{eurKurz(rw?.nettoBrennrate)}</div>
            <div className="h">je Monat im Mittel</div></div>
          <div><div className="k">Reichweite</div>
            <div className="w num">{rw?.reichweiteBrutto != null ? rw.reichweiteBrutto.toFixed(1) : '–'} Monate</div>
            <div className="h">Endbestand ÷ Auszahlung</div></div>
          <div><div className="k">Erklärungsgrad</div><div className="w num">{kal ? pct(kal.erklaerungsgrad) : '–'}</div>
            <div className="h">{kal ? `${kal.stuetzstellen.length} Stützstellen` : 'nicht kalibrierbar'}</div></div>
        </div>
      </div>

      <div className="bericht-teil">
        <h2><span className="nr">Teil 2</span> Zahlungsplan</h2>
        <div className="tablewrap">
          <table className="data staffel">
            <thead>
              <tr><th>Position</th>{planmonate.map(z => <th key={z.monat} className="r">{monatKurz(z.monat)}</th>)}
                <th className="r">Summe</th></tr>
            </thead>
            <tbody>
              {([
                ['Zahlungseingang aus Umsatz', (z: any) => z.eingang_umsatz],
                ['Zugang erhaltene Anzahlungen', (z: any) => z.zugang_az],
                ['Systematischer Zufluss', (z: any) => z.systematischer_zufluss],
              ] as const).map(([b, f]) => (
                <tr key={b}><td className="indent">{b}</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                  <td className="r num">{eur0(sp(f))}</td></tr>
              ))}
              <tr className="step"><td>= Einzahlungen</td>
                {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.einzahlungen)}</td>)}
                <td className="r num"><b>{eur0(sp(z => z.einzahlungen))}</b></td></tr>
              {([
                ['Personal', (z: any) => z.personal],
                ['Sachkosten und Fremdleistungen', (z: any) => z.auszahlung_sachkosten],
                ['Zinsen und sonstige Steuern', (z: any) => z.zins_steuer],
              ] as const).map(([b, f]) => (
                <tr key={b}><td className="indent">{b}</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                  <td className="r num">{eur0(sp(f))}</td></tr>
              ))}
              <tr className="step"><td>= Auszahlungen</td>
                {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.auszahlungen)}</td>)}
                <td className="r num"><b>{eur0(sp(z => z.auszahlungen))}</b></td></tr>
              <tr className="step"><td>= Operativer Cashflow</td>
                {planmonate.map(z => <td key={z.monat} className={`r num ${vz(z.operativer_cashflow)}`}>{eur0(z.operativer_cashflow)}</td>)}
                <td className="r num"><b>{eur0(sp(z => z.operativer_cashflow))}</b></td></tr>
              {planmonate.some(z => z.finanzierung !== 0) && (
                <tr><td className="indent">Finanzierung</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{z.finanzierung ? eur0(z.finanzierung) : '–'}</td>)}
                  <td className="r num">{eur0(sp(z => z.finanzierung))}</td></tr>
              )}
              <tr className="result"><td>Liquidität Monatsende</td>
                {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.bestand)}</td>)}
                <td className="r num"><b>{eur0(planmonate[planmonate.length - 1]?.bestand)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bericht-teil">
        <h2><span className="nr">Teil 3</span> Bandbreite</h2>
        <div className="tablewrap">
          <table className="data compact">
            <thead>
              <tr><th>Szenario</th>{planmonate.map(z => <th key={z.monat} className="r">{monatKurz(z.monat)}</th>)}
                <th className="r">Jahresende</th></tr>
            </thead>
            <tbody>
              {szenarien.map(sz => (
                <tr key={sz.name}>
                  <td><b>{sz.name}</b></td>
                  {sz.zeilen.map(z => <td key={z.monat} className={`r num ${z.bestand < 0 ? 'neg' : ''}`}>{eur0(z.bestand)}</td>)}
                  <td className={`r num ${vz(sz.ende)}`}><b>{eur0(sz.ende)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {kal && (
        <div className="bericht-teil">
          <h2><span className="nr">Teil 4</span> Kalibrierung</h2>
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Stützstelle</th><th className="r">Modell</th><th className="r">Ist</th><th className="r">Abweichung</th></tr></thead>
              <tbody>
                {kal.stuetzstellen.map(x => (
                  <tr key={x.monat}>
                    <td>{monatName(x.monat)}</td>
                    <td className="r num">{eur0(x.modell)}</td>
                    <td className="r num">{eur0(x.ist)}</td>
                    <td className="r num muted">{eur0(x.abweichung)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            {kal.stuetzstellen.length} Stützstellen bei drei Parametern sind wenig. Die Werte sind belastbar
            für die Größenordnung, nicht auf den Tag genau. Importierte Kontoauszüge erhöhen die Zahl der
            Stützstellen unmittelbar.
          </p>
        </div>
      )}

      {/* Tagesgenaue Wochensicht aus der Wochenmappe – eigene Quelle */}
      <LiquiditaetWochen />
    </>
  );
}

/* =============================================== Rentabilitätsbericht */

function RentabilitaetsBericht({ jahr, monate, regionen, projekte, leistung, db1, db3, db4, evst }: any) {
  const varKosten = s(monate, (m: any) => m.variable_kosten);
  const projFix = s(monate, (m: any) => m.fixe_projektkosten);
  const gkUmlage = s(monate, (m: any) => m.verrechnete_gk);

  const kennzahlen = [
    { k: 'DB I-Marge', w: anteil(db1, leistung), h: 'Deckungsbeitrag I ÷ Betriebsleistung',
      d: 'Anteil der Leistung, der nach den variablen Einzelkosten bleibt' },
    { k: 'DB III-Marge', w: anteil(db3, leistung), h: 'Deckungsbeitrag III ÷ Betriebsleistung',
      d: 'nach fixen Projektkosten und verrechneten Bereichsgemeinkosten' },
    { k: 'Umsatzrendite', w: anteil(db4, leistung), h: 'Betriebsergebnis ÷ Betriebsleistung',
      d: 'operatives Ergebnis je Euro Leistung' },
    { k: 'Auftragsergebnisquote', w: anteil(evst, leistung),
      h: 'Auftragsergebnis ÷ Betriebsleistung',
      d: 'nach neutralem Ergebnis – ohne die Kosten auf Kostenstellen' },
    { k: 'Variable Kostenquote', w: anteil(varKosten, leistung), h: 'variable Einzelkosten ÷ Leistung',
      d: 'Material, Fremdleistungen, Lohn- und Geräteverrechnung' },
    { k: 'Gemeinkostenquote', w: anteil(gkUmlage + projFix, leistung), h: '(Projektfix + Umlage) ÷ Leistung',
      d: 'zeitabhängige und verrechnete Kosten' },
  ];

  const mitLeistung = projekte.filter((p: any) => num(p.leistung) > 0);
  const sortiert = [...mitLeistung].sort((a: any, b: any) => num(b.db3_marge) - num(a.db3_marge));

  return (
    <>
      <div className="bericht-teil">
        <h2><span className="nr">Teil 1</span> Rentabilität der Aufträge</h2>
        <p className="quelle" style={{ marginTop: 6 }}>
           Diese Margen sind <b>nicht</b> die Umsatzrendite des Unternehmens. Kosten, die
           auf Kostenstellen statt auf Aufträgen liegen – Personal und Verwaltung – sind
           hier nicht enthalten. Das geprüfte Gesamtergebnis steht in der
           <a href="/guv"> GuV</a> und auf der <a href="/abstimmung">Abstimmungsseite</a>.
        </p>
        <div className="bericht-kennzahlen">
          {kennzahlen.map(x => (
            <div key={x.k}>
              <div className="k">{x.k}</div>
              <div className={`w num ${vz(x.w)}`}>{x.w === null ? '–' : pct(x.w)}</div>
              <div className="h">{x.h}</div>
            </div>
          ))}
        </div>
        <div className="tablewrap">
          <table className="data compact">
            <thead><tr><th>Kennzahl</th><th className="r">Wert</th><th>Rechenweg</th><th>Aussage</th></tr></thead>
            <tbody>
              {kennzahlen.map(x => (
                <tr key={x.k}>
                  <td><b>{x.k}</b></td>
                  <td className={`r num ${vz(x.w)}`}>{x.w === null ? '–' : pct(x.w)}</td>
                  <td className="muted">{x.h}</td>
                  <td className="muted">{x.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Kapitalbezogene Kennzahlen wie Gesamtkapitalrendite oder ROCE lassen sich nicht bilden:
          der Auftragsbericht enthält keine Bilanzdaten. Dafür wären Anlagevermögen, Vorräte,
          Forderungen und Verbindlichkeiten nötig.
        </p>
      </div>

      {!!regionen.length && (
        <div className="bericht-teil">
          <h2><span className="nr">Bild zu Teil 2</span> Leistungsanteil der Regionen</h2>
          <RingChart summenLabel="Leistung"
            scheiben={[...regionen]
              .map((r: any, i: number) => ({ label: r.region, wert: num(r.leistung),
                                             farbe: FARBEN[i % FARBEN.length] }))
              .filter(r => r.wert > 0)
              .sort((a, b) => b.wert - a.wert)} />
        </div>
      )}

      <div className="bericht-teil">
        <h2><span className="nr">Teil 2</span> Rentabilität je Region</h2>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr><th>Region</th><th className="r">Leistung</th><th className="r">DB I-Marge</th>
                <th className="r">DB III-Marge</th><th className="r">DB IV</th><th className="r">Umsatzrendite</th>
                <th className="r">Leistungsanteil</th></tr>
            </thead>
            <tbody>
              {regionen.map((r: any) => (
                <tr key={r.regionscode}>
                  <td><b>{r.region}</b></td>
                  <td className="r num">{eur0(r.leistung)}</td>
                  <td className={`r num ${vz(anteil(r.db1, r.leistung))}`}>
                    {num(r.leistung) ? pct(anteil(r.db1, r.leistung) ?? 0) : '–'}</td>
                  <td className={`r num ${vz(anteil(r.db3, r.leistung))}`}>
                    {num(r.leistung) ? pct(anteil(r.db3, r.leistung) ?? 0) : '–'}</td>
                  <td className={`r num ${vz(r.db4)}`}>{eur0(r.db4)}</td>
                  <td className={`r num ${vz(anteil(r.db4, r.leistung))}`}>
                    {num(r.leistung) ? pct(anteil(r.db4, r.leistung) ?? 0) : '–'}</td>
                  <td className="r num muted">{pct(anteil(r.leistung, leistung) ?? 0)}</td>
                </tr>
              ))}
              <tr className="result">
                <td>Unternehmen</td>
                <td className="r num">{eur0(leistung)}</td>
                <td className="r num">{pct(anteil(db1, leistung) ?? 0)}</td>
                <td className="r num">{pct(anteil(db3, leistung) ?? 0)}</td>
                <td className="r num">{eur0(db4)}</td>
                <td className="r num">{pct(anteil(db4, leistung) ?? 0)}</td>
                <td className="r num">100,0 %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!!mitLeistung.length && (
        <div className="bericht-teil">
          <h2><span className="nr">Bild zu Teil 3</span> Stärkste und schwächste Aufträge</h2>
          <RangChart
            zeilen={(() => {
              const nachDb3 = [...mitLeistung].sort((a: any, b: any) => num(b.db3) - num(a.db3));
              return [...nachDb3.slice(0, 5), ...nachDb3.slice(-5)]
                .map((p: any) => ({
                  label: `${p.projekt_nr} ${p.projektname ?? ''}`.trim(),
                  wert: num(p.db3),
                  hinweis: `Leistung ${eurKurz(p.leistung)} · Marge ${pct(num(p.db3_marge))}`,
                }));
            })()} />
        </div>
      )}

      <div className="bericht-teil">
        <h2><span className="nr">Teil 3</span> Projekte nach Rentabilität</h2>
        <div className="tablewrap">
          <table className="data compact">
            <thead>
              <tr><th>Projekt</th><th>Region</th><th className="r">Leistung</th>
                <th className="r">DB I-Marge</th><th className="r">DB III</th><th className="r">DB III-Marge</th></tr>
            </thead>
            <tbody>
              {sortiert.slice(0, 10).map((p: any) => (
                <tr key={'t' + p.projekt_nr}>
                  <td><b>{p.projektname || p.projekt_nr}</b><div className="muted mono">{p.projekt_nr}</div></td>
                  <td className="muted">{p.region}</td>
                  <td className="r num">{eur0(p.leistung)}</td>
                  <td className="r num muted">{p.db1_marge === null ? '–' : pct(p.db1_marge)}</td>
                  <td className={`r num ${vz(p.db3)}`}>{eur0(p.db3)}</td>
                  <td className={`r num ${vz(p.db3_marge)}`}><b>{p.db3_marge === null ? '–' : pct(p.db3_marge)}</b></td>
                </tr>
              ))}
              <tr className="head-row"><td colSpan={6}>schwächste Projekte</td></tr>
              {sortiert.slice(-10).reverse().map((p: any) => (
                <tr key={'f' + p.projekt_nr}>
                  <td><b>{p.projektname || p.projekt_nr}</b><div className="muted mono">{p.projekt_nr}</div></td>
                  <td className="muted">{p.region}</td>
                  <td className="r num">{eur0(p.leistung)}</td>
                  <td className="r num muted">{p.db1_marge === null ? '–' : pct(p.db1_marge)}</td>
                  <td className={`r num ${vz(p.db3)}`}>{eur0(p.db3)}</td>
                  <td className={`r num ${vz(p.db3_marge)}`}><b>{p.db3_marge === null ? '–' : pct(p.db3_marge)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function s<T>(rows: T[], f: (r: T) => unknown) {
  return rows.reduce((a, r) => a + num(f(r)), 0);
}
