import Link from 'next/link';
import Shell from '../components/Shell';
import Unterseiten from '../components/Unterseiten';
import { requireRecht } from '@/lib/guard';
import {
  geschaeftsjahre, stundenJahr, stundenMitarbeiter, stundenProjekte,
  stundenLohnarten, stundenMitarbeiterProjekt, projektErgebnisse,
  type ProjektDb,
} from '@/lib/queries';
import { eur0, eurKurz, pct, vz, zahl, monatKurz, monat as monatName, num } from '@/lib/format';
import { StapelChart, LinienChart, RingChart, RangChart, HeatmapChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

/* Zwei Fragen, zwei Reiter: die Auslastung der Leute und die Auswertung der
   Projekte, auf denen ihre Stunden gelandet sind.  Untereinander waren das
   zwoelf Karten am Stueck – gesucht wurde immer nur eine davon. */
export const UNTERSEITEN = [
  { key: 'auslastung', label: 'Auslastung', href: '/mitarbeiter',
    hinweis: 'Wer wie ausgelastet ist, im Jahr und je Monat.' },
  { key: 'projekte', label: 'Projektauswertung', href: '/mitarbeiter/projekte',
    hinweis: 'Wohin die Stunden gingen – und was sie erwirtschaftet haben.' },
];

const std = (v: unknown, nk = 0) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: nk }).format(num(v)) + ' h';

/** Farbe der Auslastung – dieselbe Schwelle ueberall auf der Seite. */
const ton = (q: number | null) =>
  q === null ? '' : q >= 90 ? 'pos' : q >= 75 ? 'warn' : 'neg';

/**
 * Mitarbeiterauslastung.
 *
 * Aufgebaut wie die Frage gestellt wird: zuerst die Lage im Ganzen, dann
 * der Verlauf, dann jeder Einzelne – und zu jedem Einzelnen aufklappbar,
 * auf welchem Projekt seine Stunden in welchem Monat gelandet sind.
 *
 * Das Aufklappen ist ein <details> und kein Schalter im Browser: es
 * funktioniert ohne JavaScript, ueberlebt den Ausdruck und laesst sich
 * verlinken.
 *
 * Zwei Quoten stehen nebeneinander, weil sie Verschiedenes messen:
 * Auslastung ist produktiv je anwesend, Produktivquote produktiv je
 * bezahlt.  Wer nur die erste zeigt, macht die Lage zu schoen; wer nur die
 * zweite zeigt, rechnet Urlaub als Faulheit.
 */
export default async function MitarbeiterSeite(
  { searchParams, teil = 'auslastung' }:
  { searchParams: Promise<Record<string, string>>; teil?: string },
) {
  const benutzer = await requireRecht('finance.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();

  const [kopf, leute, projekte, lohnarten, detail, ergebnisse] = await Promise.all([
    stundenJahr(jahr), stundenMitarbeiter(jahr), stundenProjekte(jahr),
    stundenLohnarten(jahr), stundenMitarbeiterProjekt(jahr),
    /* Fuer die Projektauswertung: was auf denselben Projekten an Leistung und
       Deckungsbeitrag steht.  Fehlt die Auftragsrechnung, bleibt die Spalte
       leer statt die Seite zu verlieren. */
    projektErgebnisse(jahr).catch(() => []),
  ]);

  if (!kopf) {
    return (
      <Shell titel="Mitarbeiter" bereich="Auslastung und Stunden" aktiv="mitarbeiter" benutzer={benutzer}>
        <div className="note warn">
          <b>Für {jahr} sind noch keine Stunden eingelesen.</b> Die Auswertung braucht den
          Kalendariums-Export der Zeitwirtschaft. Er wird unter{' '}
          <Link href="/import" style={{ color: 'var(--accent)' }}>Datenimport</Link> als Dateiart
          <i> Stunden (Kalendarium)</i> hochgeladen — zuzuordnen ist dort nichts.
        </div>
      </Shell>
    );
  }

  const monate = [...new Set(leute.map(l => num(l.monat)))].sort((a, b) => a - b);

  /* ---- Monatsreihe über alle Mitarbeiter ---- */
  const jeMonat = monate.map(m => {
    const teil = leute.filter(l => num(l.monat) === m);
    const s = (f: (x: typeof teil[number]) => unknown) => teil.reduce((a, x) => a + num(f(x)), 0);
    const produktiv = s(x => x.produktiv), anwesend = s(x => x.anwesend), gesamt = s(x => x.gesamt);
    return {
      monat: m, koepfe: teil.length, produktiv, anwesend, gesamt,
      abwesend: s(x => x.urlaub) + s(x => x.krankheit) + s(x => x.feiertag),
      auslastung: anwesend ? (produktiv / anwesend) * 100 : null,
      produktivquote: gesamt ? (produktiv / gesamt) * 100 : null,
    };
  });

  /* ---- Je Mitarbeiter: Jahreszahlen und Monatsspalten ---- */
  const jeKopf = [...new Set(leute.map(l => l.mitarbeiter))].map(name => {
    const teil = leute.filter(l => l.mitarbeiter === name);
    const s = (f: (x: typeof teil[number]) => unknown) => teil.reduce((a, x) => a + num(f(x)), 0);
    const produktiv = s(x => x.produktiv), anwesend = s(x => x.anwesend), gesamt = s(x => x.gesamt);
    return {
      name, personalnummer: teil[0]?.personalnummer,
      produktiv, anwesend, gesamt,
      abwesend: s(x => x.urlaub) + s(x => x.krankheit) + s(x => x.feiertag),
      auslastung: anwesend ? (produktiv / anwesend) * 100 : null,
      produktivquote: gesamt ? (produktiv / gesamt) * 100 : null,
      /** produktive Stunden je Monat, für die Spalten */
      monat: new Map(teil.map(x => [num(x.monat), num(x.produktiv)])),
      quote: new Map(teil.map(x => [num(x.monat),
        num(x.anwesend) ? (num(x.produktiv) / num(x.anwesend)) * 100 : null])),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));

  /* ---- Aufklappdetail: Monat → Projekte je Mitarbeiter ---- */
  const detailJeKopf = new Map<string, typeof detail>();
  for (const d of detail) {
    const liste = detailJeKopf.get(d.mitarbeiter) ?? [];
    liste.push(d);
    detailJeKopf.set(d.mitarbeiter, liste);
  }

  /* ---- Projekte über alle Monate ---- */
  const jeProjekt = [...new Set(projekte.map(p => p.projekt_nr))].map(nr => {
    const teil = projekte.filter(x => x.projekt_nr === nr);
    return {
      projekt_nr: nr, projektname: teil[0]?.projektname, region: teil[0]?.region,
      stunden: teil.reduce((a, x) => a + num(x.stunden), 0),
      mitarbeiter: Math.max(...teil.map(x => num(x.mitarbeiter))),
    };
  }).sort((a, b) => b.stunden - a.stunden);

  /* Stunden und Ergebnis desselben Projekts nebeneinander.  Erst daraus wird
     aus "wohin gingen die Stunden" eine Auswertung: was hat die Stunde
     erwirtschaftet, und wo steht viel Zeit gegen wenig Deckungsbeitrag. */
  const ergebnisJeNr = new Map<string, ProjektDb>(
    ergebnisse.map((e): [string, ProjektDb] => [e.projekt_nr, e]),
  );
  const jeProjektPlus = jeProjekt.map(p => {
    const e = ergebnisJeNr.get(p.projekt_nr);
    const stunden = num(p.stunden);
    return {
      ...p,
      leistung: e ? num(e.leistung) : null,
      db3:      e ? num(e.db3) : null,
      leistungJeStunde: e && stunden > 0 ? num(e.leistung) / stunden : null,
      db3JeStunde:      e && stunden > 0 ? num(e.db3) / stunden : null,
    };
  });
  const mitErgebnis = jeProjektPlus.filter(p => p.leistungJeStunde !== null);

  const maxStunden = Math.max(...jeProjekt.map(p => p.stunden), 1);
  const unproduktiv = lohnarten.filter(l => !l.produktiv);
  const abwesendGesamt = num(kopf.urlaub) + num(kopf.krankheit) + num(kopf.feiertag);

  return (
    <Shell titel="Mitarbeiter"
           bereich={`${jahr} · ${kopf.mitarbeiter} Mitarbeiter · Januar bis ${monatName(num(kopf.bis_monat))}`}
           aktiv="mitarbeiter" benutzer={benutzer}
           aktion={
             <form method="get" style={{ display: 'flex', gap: 8 }}>
               <select name="jahr" defaultValue={String(jahr)}>
                 {jahre.map(j => <option key={j} value={j}>{j}</option>)}
               </select>
               <button className="btn" type="submit">Anzeigen</button>
             </form>
           }>
      <Unterseiten seiten={UNTERSEITEN} aktiv={teil} />

      {teil === 'auslastung' && <>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Bezahlte Stunden</div>
          <div className="value num">{std(kopf.gesamt)}</div>
          <div className="sub">{zahl(kopf.mitarbeiter)} Mitarbeiter</div>
        </div>
        <div className="kpi good">
          <div className="label">Auf Aufträgen</div>
          <div className="value num">{std(kopf.produktiv)}</div>
          <div className="sub">produktive Stunden</div>
        </div>
        <div className={`kpi ${num(kopf.produktivquote) >= 70 ? 'good' : ''}`}>
          <div className="label">Produktivquote</div>
          <div className="value num">{pct(kopf.produktivquote)}</div>
          <div className="sub">produktiv ÷ bezahlt</div>
        </div>
        <div className={`kpi ${num(kopf.auslastung) >= 90 ? 'good' : ''}`}>
          <div className="label">Auslastung</div>
          <div className="value num">{pct(kopf.auslastung)}</div>
          <div className="sub">produktiv ÷ anwesend</div>
        </div>
      </div>

      {/* ------------------------------------------------ Bilder zur Auslastung
          Stunden liest man schlecht als Zahlenkolonne: ob ein Monat aus der
          Reihe faellt, sieht man in einer Saeule sofort und in einer Tabelle
          erst nach dem dritten Vergleich. */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Verlauf</div>
                 <h2>Woraus die bezahlte Zeit besteht</h2></div>
          </div>
          <div className="legend">
            <span><i style={{ background: '#0d9488' }} />auf Aufträgen</span>
            <span><i style={{ background: '#b45309' }} />unproduktiv</span>
            <span><i style={{ background: '#94a3b8' }} />Urlaub, Krankheit, Feiertag</span>
          </div>
          <div className="card-body">
            <StapelChart
              kategorien={jeMonat.map(m => monatKurz(m.monat))}
              einheit={v => std(v)}
              serien={[
                { label: 'auf Aufträgen', farbe: '#0d9488', werte: jeMonat.map(m => m.produktiv) },
                { label: 'unproduktiv', farbe: '#b45309',
                  werte: jeMonat.map(m => Math.max(0, m.anwesend - m.produktiv)) },
                { label: 'abwesend', farbe: '#94a3b8', werte: jeMonat.map(m => m.abwesend) },
              ]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Verlauf</div>
                 <h2>Auslastung und Produktivquote</h2></div>
          </div>
          <div className="legend">
            <span><i style={{ background: '#2563eb' }} />Auslastung</span>
            <span><i style={{ background: '#0d9488' }} />Produktivquote</span>
          </div>
          <div className="card-body">
            <LinienChart
              monate={jeMonat.map(m => m.monat)}
              einheit={v => pct(v, 0)}
              serien={[
                { label: 'Auslastung', farbe: '#2563eb', werte: jeMonat.map(m => num(m.auslastung)) },
                { label: 'Produktivquote', farbe: '#0d9488', werte: jeMonat.map(m => num(m.produktivquote)) },
              ]} />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Rangfolge</div>
                 <h2>Produktive Stunden je Mitarbeiter</h2></div>
          </div>
          <div className="card-body">
            <RangChart zweifarbig={false} einheit={v => std(v)}
              zeilen={[...jeKopf].sort((a, b) => b.produktiv - a.produktiv).slice(0, 20)
                .map(k => ({ label: k.name, wert: k.produktiv,
                             hinweis: k.auslastung === null ? undefined : `Auslastung ${pct(k.auslastung)}` }))} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Zusammensetzung</div>
                 <h2>Wofür die Zeit ohne Auftrag draufgeht</h2></div>
          </div>
          <div className="card-body">
            <RingChart summenLabel="ohne Auftrag" einheit={v => std(v)}
              scheiben={unproduktiv.slice(0, 9).map((l, i) => ({
                label: l.lohnart, wert: num(l.stunden), farbe: FARBEN[i % FARBEN.length] }))} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Kachelbild</div>
               <h2>Auslastung je Mitarbeiter und Monat</h2></div>
        </div>
        <div className="card-body">
          <HeatmapChart
            zeilen={[...jeKopf].sort((a, b) => b.produktiv - a.produktiv).map(k => k.name)}
            spalten={monate.map(m => monatKurz(m))}
            einheit={v => pct(v, 0)}
            mitte={75}
            werte={[...jeKopf].sort((a, b) => b.produktiv - a.produktiv)
              .map(k => monate.map(m => {
                const q = k.quote.get(m);
                return q === null || q === undefined ? null : num(q);
              }))} />
        </div>
      </div>

      {/* ------------------------------------------------ Monatsverlauf */}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Verlauf</div><h2>Auslastung je Monat</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Monat</th><th className="r">Köpfe</th><th className="r">Produktiv</th>
                    <th className="r">Anwesend</th><th className="r">Abwesend</th>
                    <th className="r">Bezahlt</th><th className="r">Auslastung</th>
                    <th className="r">Produktivquote</th></tr>
              </thead>
              <tbody>
                {jeMonat.map(m => (
                  <tr key={m.monat}>
                    <td><b>{monatName(m.monat)}</b></td>
                    <td className="r num muted">{zahl(m.koepfe)}</td>
                    <td className="r num">{std(m.produktiv)}</td>
                    <td className="r num muted">{std(m.anwesend)}</td>
                    <td className="r num muted">{std(m.abwesend)}</td>
                    <td className="r num muted">{std(m.gesamt)}</td>
                    <td className="r num">
                      <span className={`chip ${ton(m.auslastung)}`}>
                        {m.auslastung === null ? '–' : pct(m.auslastung)}
                      </span>
                    </td>
                    <td className="r num">{m.produktivquote === null ? '–' : pct(m.produktivquote)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><b>Gesamt</b></td>
                  <td className="r num">{zahl(kopf.mitarbeiter)}</td>
                  <td className="r num"><b>{std(kopf.produktiv)}</b></td>
                  <td className="r num">{std(num(kopf.produktiv) + num(kopf.unproduktiv))}</td>
                  <td className="r num">{std(abwesendGesamt)}</td>
                  <td className="r num">{std(kopf.gesamt)}</td>
                  <td className="r num"><b>{pct(kopf.auslastung)}</b></td>
                  <td className="r num"><b>{pct(kopf.produktivquote)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------- Mitarbeiter × Monat */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Je Mitarbeiter</div>
            <h2>Produktive Stunden je Monat</h2>
          </div>
          <span className="chip info">{jeKopf.length} Mitarbeiter</span>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  {monate.map(m => <th key={m} className="r">{monatKurz(m)}</th>)}
                  <th className="r">Produktiv</th>
                  <th className="r">Abwesend</th>
                  <th className="r">Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {jeKopf.map(m => (
                  <tr key={m.name}>
                    <td>
                      <b>{m.name}</b>
                      {m.personalnummer && (
                        <div className="muted mono" style={{ fontSize: 11 }}>{m.personalnummer}</div>
                      )}
                    </td>
                    {monate.map(mo => {
                      const h = m.monat.get(mo) ?? 0;
                      const q = m.quote.get(mo) ?? null;
                      return (
                        <td key={mo} className="r num" title={q === null ? undefined : `Auslastung ${pct(q)}`}>
                          {h ? std(h) : <span className="muted">–</span>}
                        </td>
                      );
                    })}
                    <td className="r num"><b>{std(m.produktiv)}</b></td>
                    <td className="r num muted">{std(m.abwesend)}</td>
                    <td className="r num">
                      <span className={`chip ${ton(m.auslastung)}`}>
                        {m.auslastung === null ? '–' : pct(m.auslastung)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><b>Gesamt</b></td>
                  {monate.map(mo => (
                    <td key={mo} className="r num">
                      <b>{std(jeMonat.find(x => x.monat === mo)?.produktiv ?? 0)}</b>
                    </td>
                  ))}
                  <td className="r num"><b>{std(kopf.produktiv)}</b></td>
                  <td className="r num">{std(abwesendGesamt)}</td>
                  <td className="r num"><b>{pct(kopf.auslastung)}</b></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* --------------------------- Aufriss je Mitarbeiter und Monat */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Aufriss</div>
            <h2>Projektstunden je Mitarbeiter und Monat</h2>
          </div>
        </div>
        <div className="card-body">
          {jeKopf.map(m => {
            const zeilen = detailJeKopf.get(m.name) ?? [];
            const seineMonate = [...new Set(zeilen.map(z => num(z.monat)))].sort((a, b) => a - b);
            return (
              <details key={m.name} className="aufriss">
                <summary>
                  <b>{m.name}</b>
                  <span className="muted">
                    {std(m.produktiv)} produktiv · {seineMonate.length} Monate ·{' '}
                    {new Set(zeilen.filter(z => z.produktiv).map(z => z.projekt_nr)).size} Projekte
                  </span>
                  <span className={`chip ${ton(m.auslastung)}`}>
                    {m.auslastung === null ? '–' : pct(m.auslastung)}
                  </span>
                </summary>
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th style={{ width: 110 }}>Monat</th><th>Projekt / Grund</th>
                          <th>Region</th><th className="r">Tage</th><th className="r">Stunden</th></tr>
                    </thead>
                    <tbody>
                      {seineMonate.map(mo => {
                        const teil = zeilen.filter(z => num(z.monat) === mo);
                        const summe = teil.reduce((a, z) => a + num(z.stunden), 0);
                        return teil.map((z, i) => (
                          <tr key={`${mo}-${z.projekt_nr ?? z.lohnart}-${i}`}
                              className={i === teil.length - 1 ? 'sub' : undefined}>
                            <td>{i === 0 ? <b>{monatName(mo)}</b> : ''}</td>
                            <td>
                              {z.produktiv && z.projekt_nr ? (
                                <>
                                  <Link href={`/projekte/${z.projekt_nr}`} className="mono"
                                        style={{ color: 'var(--accent)' }}>{z.projekt_nr}</Link>
                                  {z.projektname && <span className="muted"> · {z.projektname}</span>}
                                </>
                              ) : <span className="muted">{z.lohnart}</span>}
                            </td>
                            <td className="muted">{z.produktiv ? (z.region ?? '–') : '–'}</td>
                            <td className="r num muted">{zahl(z.tage)}</td>
                            <td className="r num">
                              {std(z.stunden, 1)}
                              {i === teil.length - 1 && (
                                <div className="muted" style={{ fontSize: 11 }}>
                                  {monatKurz(mo)} gesamt {std(summe, 1)}
                                </div>
                              )}
                            </td>
                          </tr>
                        ));
                      })}
                      {!zeilen.length && (
                        <tr><td colSpan={5}><div className="empty">Keine Stunden erfasst.</div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      </>}

      {teil === 'projekte' && <>
      {!!mitErgebnis.length && (
        <div className="kpis">
          <div className="kpi accent">
            <div className="label">Leistung je produktiver Stunde</div>
            <div className="value num">
              {eur0(mitErgebnis.reduce((a, p) => a + num(p.leistung), 0)
                  / Math.max(mitErgebnis.reduce((a, p) => a + num(p.stunden), 0), 1))}
            </div>
            <div className="sub">über {zahl(mitErgebnis.length)} Projekte mit Auftragsrechnung</div>
          </div>
          <div className="kpi">
            <div className="label">Stunden auf diesen Projekten</div>
            <div className="value num">{std(mitErgebnis.reduce((a, p) => a + num(p.stunden), 0))}</div>
            <div className="sub">von {std(jeProjekt.reduce((a, p) => a + num(p.stunden), 0))} insgesamt</div>
          </div>
          <div className="kpi">
            <div className="label">Projekte ohne Auftragsrechnung</div>
            <div className="value num">{zahl(jeProjekt.length - mitErgebnis.length)}</div>
            <div className="sub">Stunden gebucht, aber kein Ergebnis – meist Innenaufträge</div>
          </div>
        </div>
      )}

      {mitErgebnis.length > 3 && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Rangfolge</div>
                 <h2>Was die Stunde erwirtschaftet</h2></div>
          </div>
          <div className="card-body">
            <RangChart zeilen={[...mitErgebnis]
              .sort((a, b) => num(b.leistungJeStunde) - num(a.leistungJeStunde))
              .slice(0, 14)
              .map(p => ({
                label: `${p.projekt_nr} ${p.projektname ?? ''}`.trim(),
                wert: num(p.leistungJeStunde),
                hinweis: `${std(p.stunden)} · Leistung ${eurKurz(p.leistung)}`,
              }))} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Je Projekt</div>
               <h2>Wohin die Stunden gingen</h2></div>
          <span className="chip info">{jeProjekt.length} Projekte</span>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Projekt</th><th>Bezeichnung</th><th>Region</th>
                    <th className="r">Mitarbeiter</th><th className="r">Stunden</th>
                    <th className="r">Leistung</th><th className="r">DB III</th>
                    <th className="r">Leistung je Std.</th><th className="r">DB III je Std.</th>
                    <th style={{ width: 120 }}>Anteil Stunden</th></tr>
              </thead>
              <tbody>
                {jeProjektPlus.map(p => (
                  <tr key={p.projekt_nr}>
                    <td className="mono">
                      <Link href={`/projekte/${p.projekt_nr}`} style={{ color: 'var(--accent)' }}>
                        {p.projekt_nr}
                      </Link>
                    </td>
                    <td>{p.projektname ?? '–'}</td>
                    <td className="muted">{p.region}</td>
                    <td className="r num muted">{zahl(p.mitarbeiter)}</td>
                    <td className="r num"><b>{std(p.stunden)}</b></td>
                    <td className="r num">{p.leistung === null ? '–' : eur0(p.leistung)}</td>
                    <td className={`r num ${p.db3 === null ? '' : vz(p.db3)}`}>
                      {p.db3 === null ? '–' : eur0(p.db3)}
                    </td>
                    <td className="r num">
                      {p.leistungJeStunde === null ? '–' : eur0(p.leistungJeStunde)}
                    </td>
                    <td className={`r num ${p.db3JeStunde === null ? '' : vz(p.db3JeStunde)}`}>
                      {p.db3JeStunde === null ? '–' : eur0(p.db3JeStunde)}
                    </td>
                    <td>
                      <span className="bartrack">
                        <i className="pos" style={{ width: `${(p.stunden / maxStunden) * 100}%` }} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </>}

      {teil === 'auslastung' && <>
      {/* ------------------------------------------ Nicht produktive Zeit */}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Ohne Auftrag</div><h2>Wofür die übrige Zeit draufgeht</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Lohnart</th><th className="r">Stunden</th>
                         <th className="r">Anteil an bezahlt</th></tr></thead>
              <tbody>
                {unproduktiv.map(l => (
                  <tr key={l.lohnart}>
                    <td><b>{l.lohnart}</b></td>
                    <td className="r num">{std(l.stunden)}</td>
                    <td className="r num muted">{pct((num(l.stunden) / num(kopf.gesamt)) * 100)}</td>
                  </tr>
                ))}
                {!unproduktiv.length && (
                  <tr><td colSpan={3}><div className="empty">Keine Zeit ohne Auftrag erfasst.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>}
    </Shell>
  );
}
