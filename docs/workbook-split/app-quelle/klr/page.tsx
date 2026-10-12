import Link from 'next/link';
import Shell from '../components/Shell';
import PeriodenWahl from '../components/PeriodenWahl';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../components/RegionsHinweis';
import { geschaeftsjahre, kostenartenRechnung, perioden, gemeinkostenRegion, innenauftraege, letzterBelastbarerMonat } from '@/lib/queries';
import { eur0, eurKurz, pct, vz, monatKurz, zahl, num } from '@/lib/format';
import { zeitraum } from '@/lib/zeitraum';
import { RingChart, RangChart, HeatmapChart, StapelChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

const STUFE: Record<number, { name: string; erklaerung: string }> = {
  0: { name: 'Betriebsleistung', erklaerung: 'Erlöse und Bestandsveränderung – Vorzeichen für die Darstellung gedreht' },
  1: { name: 'Variable Einzelkosten (DB1)', erklaerung: 'leistungsabhängig und direkt zurechenbar' },
  2: { name: 'Fixe Kosten (DB2 – DB4)', erklaerung: 'zeitabhängige Kosten der Projekte, Bereiche und der Zentrale' },
  9: { name: 'Neutrales Ergebnis', erklaerung: 'außerhalb der Deckungsbeitragsrechnung: Zinsen, Steuern, kalkulatorisch, periodenfremd' },
};

export default async function KlrSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('klr.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();

  /* Ohne ausdrueckliche Wahl endet die Auswertung beim letzten
     abgeschlossenen Monat – ein angebrochener Monat traegt Kosten,
     aber noch nicht die Erloese. */
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));
  const [zeilen, monate, gkAlle, iaAlle] = await Promise.all([
    kostenartenRechnung(jahr, z.von, z.bis), perioden(jahr), gemeinkostenRegion(), innenauftraege(),
  ]);
  const gk = nurErlaubteRegionen(gkAlle, benutzer);
  const ia = nurErlaubteRegionen(iaAlle, benutzer);

  const gkRegionen = [...new Set(gk.map(g => g.region))].sort();
  const gkFunktionen = [...new Set(gk.map(g => g.funktion))].sort();
  const gkWert = (r: string, f: string, feld: 'primaerkosten' | 'umlage' | 'deckungsdifferenz') =>
    gk.filter(g => g.region === r && g.funktion === f).reduce((a, g) => a + num(g[feld]), 0);
  const gkSumme = (feld: 'primaerkosten' | 'umlage' | 'deckungsdifferenz') =>
    gk.reduce((a, g) => a + num(g[feld]), 0);

  const stufen = [0, 1, 2, 9].filter(s => zeilen.some(z => z.db_stufe === s));

  /** Anzeigebetrag: Leistung positiv, Kosten positiv, jeweils in ihrer eigenen Logik. */
  const anzeige = (z: { db_stufe: number; wert: number }) => z.db_stufe === 0 ? -num(z.wert) : num(z.wert);

  return (
    <Shell titel="Kostenarten- und Leistungsrechnung" bereich={`${z.text} ${jahr}`} aktiv="klr" benutzer={benutzer}>
      <div className="card"><PeriodenWahl pfad="/klr" jahre={jahre} jahr={jahr} zeitraum={z} /></div>

      {/* ---------------------------------------------- Bilder zur Rechnung
          Die Kostenartenrechnung ist eine lange Liste von Konten.  Welche
          Gruppen das Jahr tatsaechlich tragen und welche nur Rauschen sind,
          sieht man erst, wenn die Laenge den Betrag zeigt. */}
      {!!zeilen.length && (() => {
        const gruppen = [...new Set(zeilen.filter(z => z.db_stufe > 0).map(z => z.klr_gruppe))]
          .map((g, i) => ({
            label: g,
            wert: zeilen.filter(z => z.klr_gruppe === g).reduce((a, z) => a + Math.abs(num(z.wert)), 0),
            farbe: FARBEN[i % FARBEN.length],
          }))
          .filter(g => g.wert > 0).sort((a, b) => b.wert - a.wert);

        /* Die groesste Kostenart ist rund fuenfzehnmal so gross wie die
           zweitgroesste.  Bliebe sie im Balkenbild, waeren alle anderen ein
           Strich – deshalb steht sie als Satz darueber und das Bild zeigt,
           was danach kommt. */
        const nachBetrag = [...zeilen].filter(z => z.db_stufe > 0)
          .sort((a, b) => Math.abs(num(b.wert)) - Math.abs(num(a.wert)));
        const groesste = nachBetrag[0];
        const kostenSumme = nachBetrag.reduce((a, z) => a + Math.abs(num(z.wert)), 0);
        const grossteKonten = nachBetrag.slice(1, 16);

        const gruppenTop = gruppen.slice(0, 6);
        return (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Kosten je KLR-Gruppe</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={gruppen.slice(0, 9)} summenLabel="Kosten" />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Rangfolge</div>
                       <h2>Die größten Kostenarten nach der ersten</h2>
                       {groesste && (
                         <p>Mit Abstand die größte ist <b>{groesste.kostenart_nr} {groesste.kostenart_bez}</b> mit{' '}
                            <b className="num">{eur0(Math.abs(num(groesste.wert)))}</b> – das sind{' '}
                            {pct((Math.abs(num(groesste.wert)) / (kostenSumme || 1)) * 100)} aller Kosten
                            und rund das Fünfzehnfache der nächsten. Sie steht hier nicht im Bild,
                            weil daneben alles andere ein Strich wäre.</p>
                       )}</div>
                </div>
                <div className="card-body">
                  <RangChart zweifarbig={false}
                    zeilen={grossteKonten.map(z => ({
                      label: `${z.kostenart_nr} ${z.kostenart_bez}`,
                      wert: Math.abs(num(z.wert)),
                      hinweis: `${zahl(z.belege)} Belege`,
                    }))} />
                </div>
              </div>
            </div>

            {!!monate.length && (
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Verlauf</div>
                       <h2>Kostenverlauf je Gruppe</h2></div>
                </div>
                <div className="legend">
                  {gruppenTop.map(g => (
                    <span key={g.label}><i style={{ background: g.farbe }} />{g.label}</span>
                  ))}
                </div>
                <div className="card-body">
                  <StapelChart
                    kategorien={monate.map(m => monatKurz(m))}
                    serien={gruppenTop.map(g => ({
                      label: g.label, farbe: g.farbe,
                      werte: monate.map(m => zeilen.filter(z => z.klr_gruppe === g.label)
                        .reduce((a, z) => a + Math.abs(num(z.monate[m] ?? 0)), 0)),
                    }))} />
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* -------------------------------------- Gemeinkosten der Stellen */}
      {!!gk.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Kostenstellen und Umlage</div>
              <h2>Gemeinkosten je Region und Funktion</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Region</th>
                    {gkFunktionen.map(f => <th key={f} className="r">{f}</th>)}
                    <th className="r">Primärkosten</th><th className="r">Umlage</th>
                    <th className="r">Differenz</th></tr>
                </thead>
                <tbody>
                  {gkRegionen.map(r => {
                    const diff = gkFunktionen.reduce((a, f) => a + gkWert(r, f, 'deckungsdifferenz'), 0);
                    return (
                      <tr key={r}>
                        <td><b>{r}</b></td>
                        {gkFunktionen.map(f => {
                          const w = gkWert(r, f, 'deckungsdifferenz');
                          return (
                            <td key={f} className={`r num ${w ? vz(-w) : 'muted'}`}>
                              {w ? eur0(w) : '–'}
                            </td>
                          );
                        })}
                        <td className="r num">{eur0(gkFunktionen.reduce((a, f) => a + gkWert(r, f, 'primaerkosten'), 0))}</td>
                        <td className="r num">{eur0(gkFunktionen.reduce((a, f) => a + gkWert(r, f, 'umlage'), 0))}</td>
                        <td className={`r num ${vz(-diff)}`}><b>{eur0(diff)}</b></td>
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td>Gesamt</td>
                    {gkFunktionen.map(f => (
                      <td key={f} className="r num">
                        {eur0(gkRegionen.reduce((a, r) => a + gkWert(r, f, 'deckungsdifferenz'), 0))}
                      </td>
                    ))}
                    <td className="r num">{eur0(gkSumme('primaerkosten'))}</td>
                    <td className="r num">{eur0(gkSumme('umlage'))}</td>
                    <td className="r num"><b>{eur0(gkSumme('deckungsdifferenz'))}</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Zwei Punkte springen ins Auge: Die <b>Verwaltung wird nicht umgelegt</b> – ihre
              {' '}{eur0(gkRegionen.includes('Verwaltung')
                ? gkFunktionen.reduce((a, f) => a + gkWert('Verwaltung', f, 'primaerkosten'), 0) : 0)}
              {' '}bleiben stehen und belasten das Gesamtergebnis unverteilt. Und der Zuschlag von
              12 % legt insgesamt <b>{eur0(Math.abs(gkSumme('deckungsdifferenz')))}</b> mehr um,
              als die Stellen kosten – die Projekte tragen also mehr Gemeinkosten als tatsächlich
              angefallen sind.
            </span>
          </div>
        </div>
      )}

      {!!gk.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Kachelbild</div>
                 <h2>Deckungsdifferenz je Region und Funktion</h2></div>
          </div>
          <div className="card-body">
            <HeatmapChart
              zeilen={gkFunktionen}
              spalten={gkRegionen}
              werte={gkFunktionen.map(f => gkRegionen.map(r => -gkWert(r, f, 'deckungsdifferenz')))} />
          </div>
        </div>
      )}

      {!!ia.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Aufriss</div><h2>Die einzelnen Innenaufträge</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Auftrag</th><th>Bezeichnung</th><th>Region</th><th>Funktion</th>
                      <th className="r">Primärkosten</th><th className="r">Umlage</th>
                      <th className="r">Saldo</th><th className="r">Zeilen</th></tr>
                </thead>
                <tbody>
                  {ia.map(a => (
                    <tr key={a.auftrag}>
                      <td className="num">{a.auftrag}</td>
                      <td>{a.bezeichnung}</td>
                      <td className="muted">{a.region}</td>
                      <td className="muted">{a.funktion}</td>
                      <td className="r num">{eur0(a.primaerkosten)}</td>
                      <td className="r num">{num(a.umlage) ? eur0(a.umlage) : '–'}</td>
                      <td className={`r num ${vz(-num(a.saldo))}`}><b>{eur0(a.saldo)}</b></td>
                      <td className="r num muted">{a.zeilen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {stufen.map(stufe => {
        const rows = zeilen.filter(z => z.db_stufe === stufe);
        const summeStufe = rows.reduce((a, z) => a + anzeige(z), 0);
        const monatsSumme = (m: number) =>
          rows.reduce((a, z) => a + (stufe === 0 ? -(z.monate[m] ?? 0) : (z.monate[m] ?? 0)), 0);

        return (
          <div className="card" key={stufe}>
            <div className="card-head">
              <div>
                <div className="eyebrow">DB-Stufe {stufe}</div>
                <h2>{STUFE[stufe].name}</h2>
              </div>
              <span className={`chip ${stufe === 0 ? 'info' : 'neg'}`}>{eur0(summeStufe)}</span>
            </div>
            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Konto</th><th>Bezeichnung</th><th>Kostengruppe</th>
                      <th className="r">Belege</th>
                      {monate.map(m => <th key={m} className="r">{monatKurz(m)}</th>)}
                      <th className="r fix-r">Geschäftsjahr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(z => (
                      <tr key={z.kostenart_nr}>
                        <td className="mono">
                          <Link href={`/buchungen?jahr=${jahr}&kostenart=${encodeURIComponent(z.kostenart_nr)}`}
                                style={{ color: 'var(--accent)' }}>
                            {z.kostenart_nr.replace(/\.0$/, '')}
                          </Link>
                        </td>
                        <td>{z.kostenart_bez}</td>
                        <td className="muted">{z.klr_gruppe}</td>
                        <td className="r num muted">{zahl(z.belege)}</td>
                        {monate.map(m => {
                          const v = stufe === 0 ? -(z.monate[m] ?? 0) : (z.monate[m] ?? 0);
                          return <td key={m} className="r num">{v ? eur0(v) : <span className="muted">–</span>}</td>;
                        })}
                        <td className={`r num fix-r ${vz(anzeige(z))}`}><b>{eur0(anzeige(z))}</b></td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td colSpan={3}>Summe {STUFE[stufe].name}</td>
                      <td className="r num">{zahl(rows.reduce((a, z) => a + z.belege, 0))}</td>
                      {monate.map(m => <td key={m} className="r num">{eur0(monatsSumme(m))}</td>)}
                      <td className="r num fix-r">{eur0(summeStufe)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </Shell>
  );
}
