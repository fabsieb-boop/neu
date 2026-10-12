import React from 'react';
import Shell from '../components/Shell';
import PeriodenWahl from '../components/PeriodenWahl';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import { geschaeftsjahreQuellen, guvMonate, ebitdaUeberleitung, guvReferenz, guvRegionStaffel, guvRegionKonten, guvAbschluss, guvAbschlussKonten, letzterBelastbarerMonat } from '@/lib/queries';
import { eur0, eurKurz, pct, anteil, vz, monatKurz, num } from '@/lib/format';
import { SaeulenChart, LinienChart, WasserfallChart, RingChart, RangChart, HeatmapChart, FARBEN } from '../components/Charts';
import { zeitraum } from '@/lib/zeitraum';

export const dynamic = 'force-dynamic';

export default async function GuvSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('finance.read');
  const sp = await searchParams;
  /* Abgeschlossene Jahre liegen oft nur noch als Kontensaldenliste vor.
     Die GuV laesst sich daraus vollstaendig zeigen – deshalb stehen sie
     hier zur Wahl, anders als auf den Seiten, die Einzelposten brauchen. */
  const quellen = await geschaeftsjahreQuellen();
  const jahre = quellen.map(q => Number(q.jahr));
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const quelle = quellen.find(q => Number(q.jahr) === jahr);
  const nurAbschluss = !!quelle && Number(quelle.buchungen) === 0 && Number(quelle.konten) > 0;
  /* Ohne ausdrueckliche Wahl endet die Auswertung beim letzten
     abgeschlossenen Monat – ein angebrochener Monat traegt Kosten,
     aber noch nicht die Erloese. */
  /* Bis hierhin wird gerechnet; alles danach steht schraffiert da, statt
     zu fehlen. Der Schalter dafuer liegt unter Einstellungen. */
  const belastbarBis = await letzterBelastbarerMonat(jahr);
  const z = zeitraum(sp, belastbarBis);

  if (nurAbschluss) {
    const [gruppen, konten, eck] = await Promise.all([
      guvAbschluss(jahr), guvAbschlussKonten(jahr),
      /* Fuer ein abgeschlossenes Jahr liegen die Eckwerte zusaetzlich als
         Vorjahresspalte des Folgejahres vor.  Sie stammen aus einem anderen
         Stand als die Saldenliste – das gehoert nebeneinander und nicht
         verschwiegen. */
      guvReferenz(jahr + 1).catch(() => []),
    ]);
    const eckwert = (pos: string) =>
      num(eck.find(e => e.szenario === 'vorjahr' && e.position === pos)?.betrag);
    const summe = (bis: number) =>
      gruppen.filter(g => Number(g.guv_sort) <= bis).reduce((a, g) => a + num(g.betrag), 0);
    const leistung = -summe(20);
    const ergebnis = -summe(999);

    return (
      <Shell titel="Gewinn- und Verlustrechnung"
             bereich={`Geschäftsjahr ${jahr} · Abschluss auf Kontenebene`}
             aktiv="guv" benutzer={benutzer}>
        <div className="card"><PeriodenWahl pfad="/guv" jahre={jahre} jahr={jahr} /></div>

        <div className="note">
          <b>{jahr} liegt als Abschluss vor, nicht als Buchungen.</b> Grundlage sind{' '}
          {konten.length} Erfolgskonten aus der Summen- und Saldenliste.
        </div>

        {!!eck.length && (() => {
          const zeilen = [
            { bez: 'Umsatzerlöse', konten: -gruppen.filter(g => Number(g.guv_sort) <= 10)
                .reduce((a, g) => a + num(g.betrag), 0), eck: eckwert('umsatz') },
            { bez: 'Bestandsveränderung', konten: -gruppen.filter(g => Number(g.guv_sort) === 20)
                .reduce((a, g) => a + num(g.betrag), 0), eck: eckwert('ba') },
            { bez: 'Personalaufwand', konten: gruppen.filter(g => g.guv_gruppe.startsWith('6 '))
                .reduce((a, g) => a + num(g.betrag), 0), eck: eckwert('personal') },
            { bez: 'Jahresergebnis', konten: -gruppen.reduce((a, g) => a + num(g.betrag), 0),
              eck: eckwert('jahresueberschussNach') },
          ].filter(z => z.eck !== 0);
          const offen = zeilen.filter(z => Math.abs(z.konten - z.eck) > 0.5);
          if (!offen.length) return null;
          return (
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="eyebrow">Welche Zahl gilt</div>
                  <h2>Saldenliste gegen den offiziellen Abschluss</h2>
                </div>
                <span className="chip warn">{offen.length} Positionen weichen ab</span>
              </div>
              <div className="card-body flush">
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th>Position</th><th className="r">Saldenliste</th>
                          <th className="r">Abschluss</th><th className="r">Differenz</th></tr>
                    </thead>
                    <tbody>
                      {zeilen.map(z => (
                        <tr key={z.bez}>
                          <td><b>{z.bez}</b></td>
                          <td className="r num">{eur0(z.konten)}</td>
                          <td className="r num">{eur0(z.eck)}</td>
                          <td className={`r num ${vz(z.konten - z.eck)}`}>
                            {Math.abs(z.konten - z.eck) < 0.5 ? '–' : eur0(z.konten - z.eck)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="pager">
                <span className="muted">
                  Solange die Differenz offen ist, gilt für Berichte nach außen der Abschluss.
                  Die Saldenliste taugt zur Frage, <i>wo</i> etwas steht — nicht zur Frage,
                  <i> wie viel</i> es insgesamt war.
                </span>
              </div>
            </div>
          );
        })()}

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Gesamtkostenverfahren</div>
              <h2>Ergebnis {jahr}</h2>
            </div>
            <span className={`chip ${ergebnis >= 0 ? 'pos' : 'neg'}`}>
              {ergebnis >= 0 ? 'Gewinn' : 'Verlust'} {eur0(ergebnis)}
            </span>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr><th>Position</th><th className="r">Konten</th><th className="r">Betrag</th>
                      <th className="r">Anteil an der Leistung</th></tr>
                </thead>
                <tbody>
                  {gruppen.map(g => {
                    const wert = -num(g.betrag);
                    return (
                      <tr key={g.guv_gruppe}>
                        <td><b>{g.guv_gruppe}</b></td>
                        <td className="r num muted">{g.konten}</td>
                        <td className={`r num ${vz(wert)}`}>{eur0(wert)}</td>
                        <td className="r num muted">
                          {leistung ? pct(anteil(Math.abs(wert), Math.abs(leistung))) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td><b>Gesamtleistung</b></td>
                    <td className="r num muted">–</td>
                    <td className="r num"><b>{eur0(leistung)}</b></td>
                    <td className="r num muted">100,0 %</td>
                  </tr>
                  <tr>
                    <td><b>Jahresergebnis</b></td>
                    <td className="r num muted">–</td>
                    <td className={`r num ${vz(ergebnis)}`}><b>{eur0(ergebnis)}</b></td>
                    <td className="r num muted">
                      {leistung ? pct(anteil(ergebnis, leistung)) : '–'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Aufriss</div>
              <h2>Die Konten dahinter</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Position</th><th>Konto</th><th>Bezeichnung</th><th className="r">Betrag</th></tr>
                </thead>
                <tbody>
                  {konten.map(k => {
                    const wert = -num(k.wert);
                    return (
                      <tr key={`${k.guv_sort}-${k.konto}`}>
                        <td className="muted">{k.guv_gruppe}</td>
                        <td className="mono">{k.konto}</td>
                        <td>{k.text}</td>
                        <td className={`r num ${vz(wert)}`}>{eur0(wert)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const [staffelAlle, regKontenAlle] = await Promise.all([
    guvRegionStaffel(jahr, z.von, z.bis), guvRegionKonten(jahr, z.von, z.bis),
  ]);
  // Regionsfreigabe des Benutzers durchsetzen
  const staffel = nurErlaubteRegionen(staffelAlle, benutzer);
  const regKonten = nurErlaubteRegionen(regKontenAlle, benutzer);

  const [rows, ebitda, referenz] = await Promise.all([
    guvMonate(jahr, z.von, z.bis), ebitdaUeberleitung(jahr, z.von, z.bis), guvReferenz(jahr),
  ]);
  const monate = [...new Set(rows.map(r => r.monat))].sort((a, b) => a - b);

  const gruppen = new Map<string, { sort: number; name: string; monate: Record<number, number>; jahr: number }>();
  for (const r of rows) {
    let g = gruppen.get(r.guv_gruppe);
    if (!g) { g = { sort: r.guv_sort, name: r.guv_gruppe, monate: {}, jahr: 0 }; gruppen.set(r.guv_gruppe, g); }
    g.monate[r.monat] = (g.monate[r.monat] ?? 0) + num(r.betrag);
    g.jahr += num(r.betrag);
  }
  const liste = [...gruppen.values()].sort((a, b) => a.sort - b.sort);

  // Gesamtleistung = Umsatzerlöse + Bestandsveränderung (Sortiernummern 10 und 20)
  const leistung = liste.filter(g => g.sort <= 20).reduce((a, g) => a + g.jahr, 0);
  const gesamt = liste.reduce((a, g) => a + g.jahr, 0);

  const zwischen = (bisSort: number, bez: string) => ({
    bez, wert: liste.filter(g => g.sort <= bisSort).reduce((a, g) => a + g.jahr, 0),
    monate: Object.fromEntries(monate.map(m =>
      [m, liste.filter(g => g.sort <= bisSort).reduce((a, g) => a + (g.monate[m] ?? 0), 0)])),
  });

  const zwischensummen: Record<number, { bez: string; wert: number; monate: Record<number, number> }> = {
    20: zwischen(20, 'Gesamtleistung'),
    70: zwischen(70, 'Betriebsergebnis vor sonstigen Aufwendungen'),
    90: zwischen(90, 'Betriebsergebnis'),
    120: zwischen(120, 'Ergebnis vor Steuern'),
  };

  return (
    <Shell titel="Gewinn- und Verlustrechnung" bereich={`${z.text} ${jahr}`} aktiv="guv" benutzer={benutzer}>
      <div className="card"><PeriodenWahl pfad="/guv" jahre={jahre} jahr={jahr} zeitraum={z} /></div>

      {/* ------------------------------------------------ Bilder zur Rechnung
          Die Seite bestand aus zwoelf Tabellen und keinem einzigen Bild.  Wer
          wissen wollte, ob ein Monat aus der Reihe faellt, musste Zahlen
          vergleichen statt hinzusehen.  Vorzeichen: in v_guv sind Ertraege
          positiv und Aufwendungen negativ – fuer die Diagramme wird der
          Aufwand auf einen positiven Betrag gedreht, sonst zeigen die Saeulen
          nach unten. */}
      {!!monate.length && (() => {
        const aufwandM = (m: number) => -liste.filter(g => g.sort >= 40)
                                             .reduce((a, g) => a + (g.monate[m] ?? 0), 0);
        const leistungM = (m: number) => zwischensummen[20].monate[m] ?? 0;
        const ergebnisM = (m: number) => liste.reduce((a, g) => a + (g.monate[m] ?? 0), 0);

        let lauf = 0;
        const kumuliert = monate.map(m => (lauf += ergebnisM(m)));

        const kostenbloecke = liste
          .filter(g => g.sort >= 40 && g.jahr < 0)
          .map((g, i) => ({ label: g.name.replace(/^\d+ /, ''), wert: -g.jahr, farbe: FARBEN[i % FARBEN.length] }))
          .sort((a, b) => b.wert - a.wert);

        /* Der Wasserfall muss aufgehen: Gesamtleistung minus jede Stufe ergibt
           das Ergebnis.  Deshalb laufen hier alle Gruppen ab Sortiernummer 30
           mit, auch die mit positivem Saldo – sie erscheinen als Entlastung
           und nicht als Abzug.  Nimmt man nur die Aufwandsgruppen, fehlen
           die sonstigen Ertraege und der Balken am Ende passt nicht zur Summe
           der Balken davor. */
        const abzuege = liste.filter(g => g.sort >= 30)
          .map(g => ({ label: g.name.replace(/^\d+ /, ''), wert: -g.jahr }))
          .filter(a => a.wert !== 0)
          .sort((a, b) => b.wert - a.wert);
        const gross = abzuege.slice(0, 5);
        const rest = abzuege.slice(5);

        const stufen = [
          { label: 'Gesamtleistung', wert: leistung, typ: 'start' as const },
          ...gross.map(k => ({ label: k.label, wert: k.wert, typ: 'ab' as const })),
          ...(rest.length
            ? [{ label: `übrige (${rest.length})`, wert: rest.reduce((a, k) => a + k.wert, 0), typ: 'ab' as const }]
            : []),
          { label: 'Ergebnis', wert: gesamt, typ: 'ergebnis' as const },
        ];

        return (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Monatsverlauf</div>
                       <h2>Leistung und Aufwand</h2></div>
                </div>
                <div className="card-body">
                  <SaeulenChart monate={monate} serien={[
                    { label: 'Gesamtleistung', farbe: '#2563eb', werte: monate.map(leistungM) },
                    { label: 'Aufwand', farbe: '#be123c', werte: monate.map(aufwandM) },
                  ]} />
                  <div className="legend">
                    <span><i style={{ background: '#2563eb' }} />Gesamtleistung</span>
                    <span><i style={{ background: '#be123c' }} />Aufwand</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Monatsverlauf</div>
                       <h2>Ergebnis je Monat und aufgelaufen</h2></div>
                </div>
                <div className="card-body">
                  <LinienChart monate={monate} serien={[
                    { label: 'Ergebnis im Monat', farbe: '#0d9488', werte: monate.map(ergebnisM) },
                    { label: 'aufgelaufen', farbe: '#0f172a', werte: kumuliert },
                  ]} />
                  <div className="legend">
                    <span><i style={{ background: '#0d9488' }} />Ergebnis im Monat</span>
                    <span><i style={{ background: '#0f172a' }} />aufgelaufen</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div><div className="eyebrow">Von der Leistung zum Ergebnis</div>
                     <h2>Was unterwegs abgeht</h2></div>
              </div>
              <div className="card-body"><WasserfallChart schritte={stufen} /></div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Woraus der Aufwand besteht</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={kostenbloecke} summenLabel="Aufwand gesamt" />
                </div>
              </div>

              {!!staffel.length && (
                <div className="card">
                  <div className="card-head">
                    <div><div className="eyebrow">Rangfolge</div>
                         <h2>Ergebnis je Region</h2></div>
                  </div>
                  <div className="card-body">
                    <RangChart zeilen={[...staffel]
                      .sort((a, b) => num(b.ergebnis_kaufmaennisch) - num(a.ergebnis_kaufmaennisch))
                      .map(r => ({ label: r.region, wert: num(r.ergebnis_kaufmaennisch),
                                   hinweis: `Gesamtleistung ${eurKurz(r.gesamtleistung)}` }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <div><div className="eyebrow">Kachelbild</div>
                     <h2>Jede Position über die Monate</h2></div>
              </div>
              <div className="card-body">
                <HeatmapChart
                  zeilen={liste.map(g => g.name.replace(/^\d+ /, ''))}
                  spalten={monate.map(m => monatKurz(m))}
                  werte={liste.map(g => monate.map(m => g.monate[m] ?? 0))} />
              </div>
            </div>
          </>
        );
      })()}

      {/* Die Erlaeuterungen zu Darstellung, Gliederung und dem Unterschied
          zwischen dieser Seite und dem Jahresabschluss stehen jetzt
          gesammelt unter /grundsaetze – sichtbar nur mit system.read.
          Auf der Seite selbst standen sie jedem im Weg, der die Zahlen
          lesen wollte. */}

      {/* ------------------------------------------------ GuV je Region */}
      {!!staffel.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Vollständig heruntergebrochen</div>
              <h2>Gewinn- und Verlustrechnung je Region</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Region</th>
                      <th className="r">Umsatzerlöse</th>
                      <th className="r">Bestandsveränderung</th>
                      <th className="r">Gesamtleistung</th>
                      <th className="r">Aufwand Aufträge</th>
                      <th className="r">Aufwand Kostenstellen</th>
                      <th className="r">Ergebnis</th>
                      <th className="r">Marge</th></tr>
                </thead>
                <tbody>
                  {staffel.map(r => {
                    const gl = num(r.gesamtleistung);
                    const erg = num(r.ergebnis_kaufmaennisch);
                    return (
                      <tr key={r.region}>
                        <td><b>{r.region}</b>
                          <span className="muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                            {r.konten} Konten
                          </span>
                        </td>
                        <td className="r num">{eur0(r.umsatzerloese)}</td>
                        <td className="r num">{eur0(r.bestandsveraenderung)}</td>
                        <td className="r num"><b>{eur0(gl)}</b></td>
                        <td className="r num neg">{eur0(-num(r.aufwand_auftrag))}</td>
                        <td className="r num neg">{eur0(-num(r.aufwand_kostenstelle))}</td>
                        <td className={`r num ${vz(erg)}`}><b>{eur0(erg)}</b></td>
                        <td className="r num muted">{gl > 0 ? pct((erg / gl) * 100) : '–'}</td>
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td>Gesamt</td>
                    <td className="r num">{eur0(staffel.reduce((a, r) => a + num(r.umsatzerloese), 0))}</td>
                    <td className="r num">{eur0(staffel.reduce((a, r) => a + num(r.bestandsveraenderung), 0))}</td>
                    <td className="r num">{eur0(staffel.reduce((a, r) => a + num(r.gesamtleistung), 0))}</td>
                    <td className="r num">{eur0(-staffel.reduce((a, r) => a + num(r.aufwand_auftrag), 0))}</td>
                    <td className="r num">{eur0(-staffel.reduce((a, r) => a + num(r.aufwand_kostenstelle), 0))}</td>
                    <td className="r num"><b>{eur0(staffel.reduce((a, r) => a + num(r.ergebnis_kaufmaennisch), 0))}</b></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Die Spalte <b>Aufwand Kostenstellen</b> ist der Teil, der bisher in keiner
              Regionsauswertung auftauchte: Personal und Verwaltung, zusammen{' '}
              {eur0(-staffel.reduce((a, r) => a + num(r.aufwand_kostenstelle), 0))}.
              Die <b>Verwaltung</b> trägt naturgemäß ein negatives Ergebnis – ihre Kosten werden
              hier bewusst <i>nicht</i> auf die Regionen umgelegt, damit jede Region ihr eigenes
              Ergebnis sieht. Die Umlage zeigt die{' '}
              <a href="/klr" style={{ color: 'var(--accent)' }}>Kostenstellenrechnung</a>.
            </span>
          </div>
        </div>
      )}

      {/* --------------------------- Die größten Konten je Region */}
      {!!regKonten.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Aufriss</div><h2>Größte Konten je Region</h2></div>
          </div>
          <div className="card-body flush">
            {staffel.filter(r => r.region !== 'Ohne Zuordnung').map(r => (
              <details key={r.region} className="region-details">
                <summary>
                  <b>{r.region}</b>
                  <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>
                    {regKonten.filter(k => k.region === r.region).length} Konten ·
                    Ergebnis {eur0(r.ergebnis_kaufmaennisch)}
                  </span>
                </summary>
                <div className="tablewrap">
                  <table className="data compact">
                    <thead><tr><th>Konto</th><th>Bezeichnung</th><th>Position</th>
                      <th className="r">Belege</th><th className="r">Betrag</th></tr></thead>
                    <tbody>
                      {regKonten.filter(k => k.region === r.region).slice(0, 15).map(k => (
                        <tr key={k.konto}>
                          <td className="num">{k.konto}</td>
                          <td>{k.kontobezeichnung}</td>
                          <td className="muted">{k.kategorie_text}</td>
                          <td className="r num muted">{k.belege}</td>
                          <td className={`r num ${vz(-num(k.wert))}`}>{eur0(-num(k.wert))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {!!referenz.length && (() => {
        const ref = (sz: string, pos: string) =>
          num(referenz.find(r => r.szenario === sz && r.position === pos)?.betrag);
        const istBis = ref('meta', 'ist_bis_periode');
        /* Reihenfolge der BCS-Staffel. stufe kennzeichnet Zwischenergebnisse. */
        const POSITIONEN: { pos: string; label: string; stufe?: boolean; ergebnis?: boolean }[] = [
          { pos: 'umsatz', label: 'Umsatzerlöse' },
          { pos: 'ba', label: 'Bestandsveränderung' },
          { pos: 'gl', label: 'Gesamtleistung', stufe: true },
          { pos: 'vorleistungen', label: 'Vorleistungen' },
          { pos: 'personal', label: 'Personalaufwand' },
          { pos: 'sachkosten', label: 'Sachkosten' },
          { pos: 'sonstErtraege', label: 'Sonstige Erträge' },
          { pos: 'neutral', label: 'Neutrales Ergebnis' },
          { pos: 'ebitda', label: 'EBITDA', stufe: true },
          { pos: 'abschreibungen', label: 'Abschreibungen' },
          { pos: 'ebit', label: 'EBIT', stufe: true },
          { pos: 'finanzergebnis', label: 'Finanzergebnis' },
          { pos: 'ergebnisVorSteuern', label: 'Ergebnis vor Steuern', stufe: true },
          { pos: 'steuern', label: 'Steuern' },
          { pos: 'jahresueberschussNach', label: 'Jahresüberschuss', ergebnis: true },
        ];
        const vj = (pos: string) => ref('vorjahr', pos);
        return (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Referenz</div>
                <h2>Offizielle BCS-GuV {jahr}</h2>
              </div>
            </div>
            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data staffel">
                  <thead>
                    <tr><th>Position</th><th className="r">Ist 1–{istBis}</th><th className="r">Forecast</th>
                        <th className="r">Jahr {jahr}</th><th className="r">Vorjahr {jahr - 1}</th>
                        <th className="r">Veränderung</th></tr>
                  </thead>
                  <tbody>
                    {POSITIONEN.map(z => {
                      const j = ref('jahr', z.pos), v = vj(z.pos);
                      const delta = v ? ((j - v) / Math.abs(v)) * 100 : null;
                      return (
                        <tr key={z.pos} className={z.ergebnis ? 'result' : z.stufe ? 'step' : ''}>
                          <td className={z.stufe || z.ergebnis ? '' : 'indent'}>{z.label}</td>
                          <td className="r num">{eur0(ref('ist', z.pos))}</td>
                          <td className="r num">{eur0(ref('fc', z.pos))}</td>
                          <td className="r num"><b>{eur0(j)}</b></td>
                          <td className="r num">{eur0(v)}</td>
                          <td className={`r num ${z.ergebnis ? '' : vz(delta)}`}>
                            {delta === null ? '–' : pct(delta)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Ergebnisabgrenzung</div>
            <h2>EBITDA-Überleitung</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead><tr><th>Position</th><th className="r">Betrag</th><th className="r">% Leistung</th></tr></thead>
              <tbody>
                <tr className="step">
                  <td>EBITDA aus Primärbuchungen
                    <span className="formula">Erträge minus Aufwendungen der EBITDA-relevanten Konten,
                      ohne innerbetriebliche Verrechnung</span></td>
                  <td className={`r num ${vz(ebitda?.ebitda_extern)}`}><b>{eur0(ebitda?.ebitda_extern)}</b></td>
                  <td className="r num muted">{leistung ? pct(anteil(ebitda?.ebitda_extern, leistung) ?? 0) : '–'}</td>
                </tr>
                <tr>
                  <td className="indent">innerbetriebliche Leistungsverrechnung
                    <span className="formula">Lohn- und Gerätestunden, Belegkreis 9028/9029/9030 –
                      Belastung der Aufträge ohne die Entlastung der Senderkostenstellen</span></td>
                  <td className={`r num ${vz(ebitda?.interne_verrechnung)}`}>{eur0(ebitda?.interne_verrechnung)}</td>
                  <td className="r num muted">{leistung ? pct(anteil(ebitda?.interne_verrechnung, leistung) ?? 0) : '–'}</td>
                </tr>
                <tr>
                  <td className="indent">Gemeinkostenzuschlag
                    <span className="formula">Konto 7801020 – saldiert über alle Aufträge auf null</span></td>
                  <td className="r num">{eur0(ebitda?.gemeinkostenumlage)}</td>
                  <td className="r num muted">–</td>
                </tr>
                <tr>
                  <td className="indent">nicht EBITDA-wirksam
                    <span className="formula">Abschreibungen, Zinsen, Ertragsteuern, periodenfremde und
                      kalkulatorische Posten</span></td>
                  <td className={`r num ${vz(ebitda?.nicht_ebitda)}`}>{eur0(ebitda?.nicht_ebitda)}</td>
                  <td className="r num muted">{leistung ? pct(anteil(ebitda?.nicht_ebitda, leistung) ?? 0) : '–'}</td>
                </tr>
                <tr className="result">
                  <td>= Ergebnis vor Steuern
                    <span className="formula">deckungsgleich mit der Deckungsbeitragsrechnung</span></td>
                  <td className="r num"><b>{eur0(ebitda?.ergebnis)}</b></td>
                  <td className="r num">{leistung ? pct(anteil(ebitda?.ergebnis, leistung) ?? 0) : '–'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">GuV-Staffel</div>
            <h2>Ergebnisrechnung {jahr}</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead>
                <tr>
                  <th>Position</th>
                  {monate.map(m => (
                    <th key={m} className={`r ${m > belastbarBis ? 'schraffiert' : ''}`}
                        title={m > belastbarBis ? 'nicht freigegeben – wird nicht gerechnet' : undefined}>
                      {monatKurz(m)}
                    </th>
                  ))}
                  <th className="r">Geschäftsjahr</th>
                  <th className="r">% Leistung</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(g => (
                  <React.Fragment key={g.name}>
                    <tr>
                      <td className="indent">{g.name.replace(/^\d+\s/, '')}</td>
                      {monate.map(m => (
                        <td key={m} className={`r num ${vz(g.monate[m] ?? 0)} ${m > belastbarBis ? 'schraffiert' : ''}`}>
                          {eur0(g.monate[m] ?? 0)}
                        </td>
                      ))}
                      <td className={`r num ${vz(g.jahr)}`}><b>{eur0(g.jahr)}</b></td>
                      <td className="r num muted">{leistung ? pct(anteil(g.jahr, leistung) ?? 0) : '–'}</td>
                    </tr>
                    {zwischensummen[g.sort] && (
                      <tr className={g.sort === 120 ? 'result' : 'step'}>
                        <td>= {zwischensummen[g.sort].bez}</td>
                        {monate.map(m => (
                          <td key={m} className={`r num ${g.sort === 120 ? '' : vz(zwischensummen[g.sort].monate[m])} ${m > belastbarBis ? 'schraffiert' : ''}`}>
                            {eur0(zwischensummen[g.sort].monate[m])}
                          </td>
                        ))}
                        <td className={`r num ${g.sort === 120 ? '' : vz(zwischensummen[g.sort].wert)}`}>
                          <b>{eur0(zwischensummen[g.sort].wert)}</b>
                        </td>
                        <td className="r num muted">
                          {leistung ? pct(anteil(zwischensummen[g.sort].wert, leistung) ?? 0) : '–'}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                <tr className="total">
                  <td>Summe aller Positionen</td>
                  {monate.map(m => (
                    <td key={m} className="r num">{eur0(liste.reduce((a, g) => a + (g.monate[m] ?? 0), 0))}</td>
                  ))}
                  <td className={`r num ${vz(gesamt)}`}>{eur0(gesamt)}</td>
                  <td className="r num">{pct(anteil(gesamt, leistung) ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
