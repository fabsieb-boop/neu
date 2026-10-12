import Link from 'next/link';
import Shell from '../../components/Shell';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../../components/RegionsHinweis';
import { sapLaeufe, sapStruktur, kontenJeRegion, guvMonate, kostenartenStamm } from '@/lib/queries';
import { eur0, vz, num, MONATE_KURZ } from '@/lib/format';

export const dynamic = 'force-dynamic';

/* Eine Zeile gilt als Summenzeile, wenn SAP sie als solche ausweist – oder
   wenn eine Positionszeile selbst einen Betrag traegt ("Summe Umsatz-Erloese",
   "Betriebs-Ergebnis").  Beides kommt im Export vor. */
const istSumme = (z: { zeilentyp: string; berichtsperiode: number }) =>
  z.zeilentyp === 'SUMME' || (z.zeilentyp === 'POSITION' && num(z.berichtsperiode) !== 0);

export default async function SapGuvSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('finance.read');
  const sp = await searchParams;

  const laeufe = await sapLaeufe();
  if (!laeufe.length) {
    return (
      <Shell titel="GuV im SAP-Aufriss" bereich="Original-Gliederung" aktiv="sap-guv" benutzer={benutzer}>
        <div className="card"><div className="card-body">
          <div className="empty">
            <b>Noch keine SAP-Auswertung eingelesen.</b>
            <p className="muted" style={{ marginTop: 8, maxWidth: 620 }}>
              Diese Seite zeigt die Bilanz/GuV genau so, wie SAP sie ausgibt – mit den
              Positionsnummern, der Einrückung und den Kontenzeilen des Originals.
              Grundlage ist der Export der Auswertung <b>Bilanz/GuV</b>. Einlesen mit:
            </p>
            <pre className="mono" style={{ marginTop: 10 }}>
              python3 scripts/sap-struktur-laden.py guv.XLSX --art GUV
            </pre>
          </div>
        </div></div>
      </Shell>
    );
  }

  const lauf = laeufe.find(l => `${l.buchungskreis}|${l.jahr}|${l.periode}|${l.art}` === sp.lauf) ?? laeufe[0];
  /* Der Aufriss je Niederlassung speist sich aus unseren Buchungszeilen –
     die tragen ein Ergebnis, keine Bestaende.  Fuer die Bilanz gibt es ihn
     deshalb nicht. */
  const ansicht = sp.ansicht === 'regionen' && lauf.art === 'GUV' ? 'regionen' : 'gesamt';
  const schluessel = (l: typeof lauf) => `${l.buchungskreis}|${l.jahr}|${l.periode}|${l.art}`;

  const zeilen = await sapStruktur(lauf.buchungskreis, lauf.jahr, lauf.periode, lauf.art);

  /* Fuer den Aufriss nach Niederlassung: unsere eigenen Buchungen bis zu dem
     Monat, den die SAP-Auswertung abdeckt.  Periode 16 ist der Abschluss und
     umfasst das ganze Jahr. */
  const sapBis = lauf.periode > 12 ? 12 : lauf.periode;
  const eigeneMonate = ansicht === 'regionen' ? await guvMonate(lauf.jahr) : [];
  const maxMonat = eigeneMonate.length ? Math.max(...eigeneMonate.map(r => num(r.monat))) : 0;
  const bis = Math.min(sapBis, maxMonat || sapBis);
  const kontenRoh = ansicht === 'regionen' ? await kontenJeRegion(lauf.jahr, bis) : [];
  const konten = nurErlaubteRegionen(kontenRoh, benutzer);
  const stamm = ansicht === 'regionen' ? await kostenartenStamm() : [];
  const bezeichnungen = new Map(stamm.map(k =>
    [String(k.kostenart_nr).replace(/\.0$/, ''), k.bezeichnung]));

  const regionen = [...new Map(konten.map(k => [k.regionscode, k.region])).entries()]
    .sort((a, b) => a[0].localeCompare(b[0]));
  const saldo = new Map<string, Map<string, number>>();      // Konto -> Region -> Wert
  for (const k of konten) {
    let m = saldo.get(k.kontonummer);
    if (!m) { m = new Map(); saldo.set(k.kontonummer, m); }
    m.set(k.regionscode, (m.get(k.regionscode) ?? 0) + num(k.wert));
  }

  /* Summen der Gliederung neu rechnen.
     ---------------------------------------------------------------------
     SAP baut die Staffel nicht ueber eine feste Baumtiefe auf, sondern
     schliesst mit jeder Summenzeile alles ab, was darunter offen ist.  Zwei
     Eigenheiten muessen dabei nachgebildet werden:

       - Nicht jede Position bekommt eine eigene Summenzeile.  Deshalb faltet
         auch eine Ueberschrift alles Tiefere zusammen, sonst rutschen fremde
         Konten in die naechste Summe.
       - Traegt eine der offenen Zeilen dieselbe Positionsnummer wie die
         Summe, gilt die Summe nur fuer diese; sonst fuer alles Tiefere.

     Gegengeprueft an den Summen, die SAP selbst ausweist:  a l l e  124 der
     GuV und  a l l e  103 der Bilanz stimmen auf den Cent.  Die drei Zeilen,
     die SAP aus der jeweils anderen Rechnung holt, sind unten eigens
     gesetzt – sie bleiben damit ebenfalls nachrechenbar. */
  type Offen = { stufe: number; position: string; werte: Record<string, number> };
  const offen: Offen[] = [];
  const werte = new Map<number, Record<string, number>>();   // lfd -> Region -> Wert
  const leer = (): Record<string, number> =>
    Object.fromEntries(regionen.map(([code]) => [code, 0]));

  for (const z of zeilen) {
    const stufe = num(z.stufe);
    if (z.zeilentyp === 'KONTO') {
      const je = saldo.get(String(z.kontonummer ?? '')) ?? new Map<string, number>();
      const zeile = leer();
      for (const [code] of regionen) zeile[code] = je.get(code) ?? 0;
      werte.set(z.lfd, zeile);
      offen.push({ stufe, position: z.position, werte: zeile });
      continue;
    }

    const tiefer = offen.filter(o => o.stufe > stufe);
    const eigene = tiefer.filter(o => o.position === z.position);
    const nehmen = new Set(eigene.length ? eigene : tiefer);
    const summe = leer();
    for (const o of nehmen)
      for (const [code] of regionen) summe[code] += o.werte[code] ?? 0;
    for (let i = offen.length - 1; i >= 0; i--) if (nehmen.has(offen[i])) offen.splice(i, 1);

    if (istSumme(z)) {
      werte.set(z.lfd, summe);
      offen.push({ stufe, position: z.position, werte: summe });
    } else if (nehmen.size) {
      offen.push({ stufe, position: z.position, werte: summe });
    }
  }

  /* Eine Zeile bildet SAP nicht aus den Konten darunter.
     ---------------------------------------------------------------------
     Position 0071000000 – die Zwischensumme nach der Ergebnis-Verwendung –
     ist die Summe der zugeordneten GuV-Konten und der Anhangskonten mit
     gedrehtem Vorzeichen.  Ohne diese Regel bliebe sie im Regionsaufriss
     leer, obwohl SAP dort einen Wert ausweist.

     (Die Bilanz kennt zwei weitere solche Zeilen – Eigenkapital und PASSIVA
     ziehen den Bilanzgewinn aus der GuV.  Der Regionsaufriss gibt es nur
     fuer die GuV, deshalb spielen sie hier keine Rolle.) */
  const kontenAnteil = (treffer: (position: string) => boolean) => {
    const summe = leer();
    for (const z of zeilen) {
      if (z.zeilentyp !== 'KONTO' || !treffer(z.position)) continue;
      const je = werte.get(z.lfd);
      if (je) for (const [code] of regionen) summe[code] -= je[code] ?? 0;
    }
    return summe;
  };

  /* Die Sonderzeile setzen, sobald alle Kontowerte feststehen. */
  for (const z of zeilen) {
    if (z.position !== '0071000000' || !istSumme(z)) continue;
    const v = kontenAnteil(p => p < '0080000000' || p.startsWith('009'));
    werte.set(z.lfd, v);
  }

  /* Nichts darf unterwegs verschwinden.
     ---------------------------------------------------------------------
     Das SAP-Geruest kennt nur Sachkonten der Finanzbuchhaltung.  Unsere
     Buchungen enthalten daneben die Verrechnungskonten der Kostenrechnung
     (7xxxxx) und – je nach Auswertungsstand – die Ertragsteuern.  Fuer die
     Gesellschaft als Ganzes heben sich die Verrechnungen auf, je
     Niederlassung aber gerade nicht: dort sind sie die Umlage.  Sie werden
     deshalb unten angehaengt statt stillschweigend weggelassen. */
  const imGeruest = new Set(zeilen.filter(z => z.zeilentyp === 'KONTO')
    .map(z => String(z.kontonummer ?? '')));
  const ohneZeile = [...saldo.entries()]
    .filter(([konto]) => !imGeruest.has(konto))
    .map(([konto, je]) => {
      const zeile = leer();
      for (const [code] of regionen) zeile[code] = je.get(code) ?? 0;
      const summe = regionen.reduce((a, [code]) => a + zeile[code], 0);
      return { konto, zeile, summe, bezeichnung: bezeichnungen.get(konto) ?? '' };
    })
    .filter(z => Math.abs(z.summe) > 0.005)
    .sort((a, b) => Math.abs(b.summe) - Math.abs(a.summe));

  const summeOhneZeile = leer();
  for (const z of ohneZeile)
    for (const [code] of regionen) summeOhneZeile[code] += z.zeile[code];

  const gesamtAusBuchungen = leer();
  for (const k of konten) gesamtAusBuchungen[k.regionscode] =
    (gesamtAusBuchungen[k.regionscode] ?? 0) + num(k.wert);

  const summeVon = (lfd: number) => {
    const z = werte.get(lfd) ?? {};
    return regionen.reduce((s, [code]) => s + (z[code] ?? 0), 0);
  };

  /* Konten, die SAP keiner Position zuordnet, fehlen im Betriebsergebnis.
     Das ist bares Geld und gehoert sichtbar an den Anfang. */
  const nichtZugeordnet = zeilen
    .filter(z => z.zeilentyp === 'KONTO' && z.position.startsWith('8'))
    .reduce((s, z) => s + num(z.berichtsperiode), 0);

  const spalten = ansicht === 'regionen' ? regionen.length + 2 : 4;

  /* In der GuV bedeutet ein negativer Betrag Ertrag, ein positiver Aufwand –
     dort traegt die Farbe eine Aussage.  In der Bilanz sagt das Vorzeichen
     nur, auf welcher Seite der Posten steht; dort bleiben die Zahlen ruhig. */
  const farbe = (wert: unknown) => (lauf.art === 'GUV' ? vz(-num(wert)) : '');

  return (
    <Shell titel="GuV im SAP-Aufriss" bereich={`Buchungskreis ${lauf.buchungskreis} · Geschäftsjahr ${lauf.jahr}`}
           aktiv="sap-guv" benutzer={benutzer}
           aktion={<span className="chip info">
             {lauf.periode > 12 ? 'Abschluss' : `Periode ${lauf.periode}`} · {lauf.konten} Konten
           </span>}>

      <RegionsHinweis benutzer={benutzer} />

      <div className="card">
        <form className="toolbar" method="get" action="/guv/sap">
          <div className="field">
            <label htmlFor="lauf">Auswertung</label>
            <select id="lauf" name="lauf" defaultValue={schluessel(lauf)}>
              {laeufe.map(l => (
                <option key={schluessel(l)} value={schluessel(l)}>
                  {l.art === 'GUV' ? 'GuV' : 'Bilanz'} {l.jahr} ·{' '}
                  {l.periode > 12 ? 'Abschluss' : `bis ${MONATE_KURZ[l.periode] ?? l.periode}`} ·
                  {' '}Buchungskreis {l.buchungskreis}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ansicht">Aufriss</label>
            <select id="ansicht" name="ansicht" defaultValue={ansicht}>
              <option value="gesamt">Gesellschaft gesamt – Zahlen aus SAP</option>
              {lauf.art === 'GUV' && (
                <option value="regionen">Je Niederlassung – aus unseren Buchungen</option>
              )}
            </select>
          </div>
          <div className="toolbar-aktionen">
            <button className="btn primary" type="submit">Anzeigen</button>
            <Link className="btn" href="/guv">Eigene Staffel</Link>
          </div>
        </form>

        <div className="card-body">
          {ansicht === 'gesamt' ? (
            <p className="muted" style={{ margin: 0, maxWidth: 900 }}>
              Zeile für Zeile die Auswertung <b>Bilanz/GuV</b> aus SAP – gleiche Reihenfolge,
              gleiche Einrückung, gleiche Positionsnummern. Vorzeichen im Original:
              Aufwand positiv, Erlös negativ.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, maxWidth: 900 }}>
              Dasselbe Gerüst, gefüllt aus unseren eigenen Buchungen und aufgeteilt nach
              Niederlassung. Die Zwischensummen sind neu gerechnet.
              {bis < sapBis && (
                <> <b>Deckt Januar bis {MONATE_KURZ[bis]} ab</b> – so weit
                reichen unsere Einzelposten. Die SAP-Spalte oben geht bis {MONATE_KURZ[sapBis]}.</>
              )}
            </p>
          )}
        </div>

        {lauf.art === 'GUV' && Math.abs(nichtZugeordnet) > 1 && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div className="note warn">
              <b>{eur0(nichtZugeordnet)}</b> stehen in SAP unter <i>Nicht zugeordnete Konten</i> und
              laufen damit am Betriebsergebnis vorbei. Konten ohne Positionszuordnung tauchen in
              keiner Zwischensumme auf – die Zuordnung pflegt die Fachabteilung im SAP-Stamm.
            </div>
          </div>
        )}

        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact sap">
              <thead>
                {ansicht === 'gesamt' ? (
                  <tr>
                    <th>Position</th><th>Konto</th>
                    <th className="r fix-r">Berichtsperiode</th>
                    <th className="r">Vergleichsperiode</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Position</th><th>Konto</th>
                    {regionen.map(([code, name]) => <th key={code} className="r">{name}</th>)}
                    <th className="r fix-r">Gesamt</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {zeilen.map(z => {
                  const summe = istSumme(z);
                  const ueberschrift = z.zeilentyp === 'POSITION' && !summe;
                  const einzug = Math.max(0, num(z.stufe) - 2) * 16;
                  const klasse = summe ? 'total' : ueberschrift ? 'gruppe' : '';
                  return (
                    <tr key={z.lfd} className={klasse}>
                      <td style={{ paddingLeft: 10 + einzug, fontWeight: summe ? 600 : ueberschrift ? 600 : 400 }}>
                        {z.text}
                      </td>
                      <td className="mono muted">{z.kontonummer ?? ''}</td>
                      {ansicht === 'gesamt' ? (
                        <>
                          <td className={`r num fix-r ${farbe(z.berichtsperiode)}`}>
                            {ueberschrift ? '' : eur0(z.berichtsperiode)}
                          </td>
                          <td className={`r num muted`}>
                            {ueberschrift ? '' : eur0(z.vergleichsperiode)}
                          </td>
                        </>
                      ) : (
                        <>
                          {regionen.map(([code]) => {
                            const v = werte.get(z.lfd)?.[code];
                            return (
                              <td key={code} className={`r num ${farbe(v ?? 0)}`}>
                                {ueberschrift || v === undefined ? '' : eur0(v)}
                              </td>
                            );
                          })}
                          <td className={`r num fix-r ${farbe(summeVon(z.lfd))}`} style={{ fontWeight: summe ? 600 : 400 }}>
                            {ueberschrift || !werte.has(z.lfd) ? '' : eur0(summeVon(z.lfd))}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {ansicht === 'regionen' && ohneZeile.length > 0 && (
                  <>
                    <tr className="gruppe">
                      <td style={{ paddingLeft: 10, fontWeight: 600 }}>
                        Ohne Zeile im SAP-Gerüst
                      </td>
                      <td className="mono muted" />
                      {regionen.map(([code]) => <td key={code} />)}
                      <td className="fix-r" />
                    </tr>
                    {ohneZeile.map(z => (
                      <tr key={`ohne-${z.konto}`}>
                        <td style={{ paddingLeft: 26 }}>{z.bezeichnung || 'ohne Bezeichnung'}</td>
                        <td className="mono muted">{z.konto}</td>
                        {regionen.map(([code]) => (
                          <td key={code} className={`r num ${farbe(z.zeile[code])}`}>{eur0(z.zeile[code])}</td>
                        ))}
                        <td className={`r num fix-r ${farbe(z.summe)}`}>{eur0(z.summe)}</td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td style={{ paddingLeft: 10 }}>Summe ohne Zeile im SAP-Gerüst</td>
                      <td className="mono muted" />
                      {regionen.map(([code]) => (
                        <td key={code} className={`r num ${farbe(summeOhneZeile[code])}`}>
                          {eur0(summeOhneZeile[code])}
                        </td>
                      ))}
                      <td className={`r num fix-r ${farbe(regionen.reduce((a, [c]) => a + summeOhneZeile[c], 0))}`}>
                        {eur0(regionen.reduce((a, [c]) => a + summeOhneZeile[c], 0))}
                      </td>
                    </tr>
                    <tr className="total">
                      <td style={{ paddingLeft: 10 }}>
                        Alle ergebniswirksamen Buchungen Januar–{MONATE_KURZ[bis]}
                      </td>
                      <td className="mono muted" />
                      {regionen.map(([code]) => (
                        <td key={code} className={`r num ${farbe(gesamtAusBuchungen[code])}`}>
                          {eur0(gesamtAusBuchungen[code])}
                        </td>
                      ))}
                      <td className={`r num fix-r ${farbe(regionen.reduce((a, [c]) => a + (gesamtAusBuchungen[c] ?? 0), 0))}`}>
                        {eur0(regionen.reduce((a, [c]) => a + (gesamtAusBuchungen[c] ?? 0), 0))}
                      </td>
                    </tr>
                  </>
                )}
                {!zeilen.length && (
                  <tr><td colSpan={spalten}><div className="empty">Keine Zeilen in dieser Auswertung.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            In allen vorliegenden SAP-Exporten steht genau ein Buchungskreis: <b>{lauf.buchungskreis}</b>.
            Kommen weitere Gesellschaften dazu, erscheinen sie nach dem Einlesen von selbst in
            der Auswahlliste – der Aufriss je Niederlassung bleibt davon unberührt.
          </p>
        </div>
      </div>
    </Shell>
  );
}
