import Shell from '../components/Shell';
import RisikoForm from './RisikoForm';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { pool } from '@/lib/db';
import { datum, zahl, eur0, pct, num } from '@/lib/format';
import { StreuChart, RingChart, RangChart, FARBEN } from '../components/Charts';
import RegionsFilter, { filterLesen } from '../components/RegionsFilter';
import Gesamtmatrix from './Gesamtmatrix';
import { risikenGesamt } from '@/lib/queries';
import { passtZuFilter } from '@/lib/filter';

export const dynamic = 'force-dynamic';

/** RPZ = Wahrscheinlichkeit × Auswirkung × Entdeckbarkeit, Wertebereich 1–125. */
function stufe(score: number) {
  if (score >= 60) return { text: 'kritisch', klasse: 'neg' };
  if (score >= 30) return { text: 'hoch', klasse: 'warn' };
  if (score >= 12) return { text: 'mittel', klasse: 'info' };
  return { text: 'gering', klasse: 'pos' };
}

export default async function RisikenSeite({ searchParams }:
  { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('risk.read');
  const sp = await searchParams;
  const { region: roheRegion, auftrag } = filterLesen(sp);
  const region = regionErzwingen(benutzer, roheRegion);
  const [risiken, projekte] = await Promise.all([
    pool.query(`SELECT r.*, p.projekt_nr, p.projektname, p.region
                  FROM controlling.risiken r
                  LEFT JOIN controlling.projekte p ON p.projekt_id=r.projekt_id
                 ORDER BY r.risikoscore DESC NULLS LAST, r.frist NULLS LAST`),
    pool.query(`SELECT projekt_id, projekt_nr, projektname FROM controlling.projekte
                 WHERE auftragstyp='PROJEKT' ORDER BY projekt_nr`),
  ]);

  /* Die aus dem Altsystem übernommenen Projektrisiken. Sie folgen nicht der
     FMEA-Logik oben, sondern der Drei-Punkt-Schätzung: aus Minimum, wahr-
     scheinlichem Wert und Maximum bildet die Datenbank den PERT-Mittelwert
     und multipliziert ihn mit der Eintrittswahrscheinlichkeit. */
  const projektrisiken = await pool.query(`
    SELECT r.id, r.projekt_nr, p.projektname,
           controlling.f_region_voll(r.projekt_nr, NULL) AS region,
           r.bezeichnung, r.kategorie, r.wahrscheinlichkeit,
           r.kosten_min, r.kosten_wahrsch, r.kosten_max, r.kosten_erwartet,
           r.dauer_erwartet, r.aktiv
      FROM controlling.projekt_risiko r
      LEFT JOIN controlling.projekte p ON p.projekt_nr = r.projekt_nr
     WHERE r.aktiv
     ORDER BY r.kosten_erwartet DESC NULLS LAST`);

  const prAlle = projektrisiken.rows;

  /* Wer nach einem Projekt gesucht hat, will es benannt sehen – nicht seinen
     eigenen Suchbegriff.  Trifft die Suche genau einen Auftrag, steht sein
     Name in der Kopfzeile; sonst bleibt es beim Suchbegriff. */
  const gesuchtesProjekt = auftrag
    ? projekte.rows.find(p =>
        String(p.projekt_nr).toLowerCase() === auftrag.toLowerCase()
        || String(p.projektname ?? '').toLowerCase() === auftrag.toLowerCase())
      ?? (() => {
        const treffer = projekte.rows.filter(p =>
          `${p.projekt_nr} ${p.projektname ?? ''}`.toLowerCase().includes(auftrag.toLowerCase()));
        return treffer.length === 1 ? treffer[0] : null;
      })()
    : null;
  const pr = prAlle.filter(r =>
    passtZuFilter(r, region, auftrag, ['projekt_nr', 'projektname', 'bezeichnung', 'kategorie']));
  const prErwartet = pr.reduce((a, r) => a + Number(r.kosten_erwartet ?? 0), 0);

  /* Für die Matrix die Risiken mit Netto-Werten und Maßnahmenstand –
     dieselbe Datenbasis wie auf der Auftragsseite, nur über alle
     Projekte. */
  const matrixAlle = await risikenGesamt();
  const matrix = matrixAlle.filter(r =>
    passtZuFilter(r, region, auftrag, ['projekt_nr', 'projektname', 'bezeichnung', 'kategorie']));
  const prProjekte = new Set(pr.map(r => r.projekt_nr)).size;

  const alle = risiken.rows;
  const rows = alle.filter(r =>
    passtZuFilter(r, region, auftrag, ['projekt_nr', 'projektname', 'bezeichnung', 'massnahme']));
  const offen = rows.filter(r => r.status === 'OFFEN');

  return (
    <Shell titel="Risikoanalyse" bereich="Risikoprioritätszahl nach FMEA-Logik" aktiv="risiken" benutzer={benutzer}
           /* Gezaehlt wird, was die Seite zeigt.  Vorher stand hier nur die
              Zahl der FMEA-Eintraege – die Tabelle ist leer, und oben rechts
              stand „0 Risiken“ ueber einer Seite voller Risiken. */
           aktion={<span className="chip info">
             {zahl(pr.length + rows.length)} Risiken
             {rows.length > 0 && <> · {zahl(rows.length)} FMEA</>}
           </span>}>

      <div className="card">
        <RegionsFilter erlaubt={benutzer.regionen} pfad="/risiken" region={region} auftrag={auftrag}
                       auftragLabel="Projekt, Risiko oder Maßnahme" />
        {(region || auftrag) && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {pr.length} von {prAlle.length} Projektrisiken · {rows.length} von {alle.length} FMEA-Einträgen
              {region && <> · Region <b>{region}</b></>}
              {auftrag && (gesuchtesProjekt
                ? <> · Projekt <b>{gesuchtesProjekt.projektname || gesuchtesProjekt.projekt_nr}</b>
                    {' '}<span className="mono">{gesuchtesProjekt.projekt_nr}</span></>
                : <> · Suche <b>{auftrag}</b></>)}
            </span>
          </div>
        )}
      </div>

      <Gesamtmatrix risiken={matrix}
                    umfang={region ? `Region ${region}`
                            : gesuchtesProjekt
                              ? `${gesuchtesProjekt.projektname || gesuchtesProjekt.projekt_nr} · ${gesuchtesProjekt.projekt_nr}`
                            : auftrag ? `Suche „${auftrag}“` : 'Alle Projekte'} />

      {/* ---------------------------------------------- Bilder zum Risiko
          Ein Risikoregister ist eine Liste, aber die Frage dahinter ist keine
          Liste: welches Risiko ist gross und gleichzeitig wahrscheinlich?
          Das beantwortet nur ein Streubild. */}
      {!!pr.length && (() => {
        /* Alle 2.265 Risiken als Blasen ergeben einen Fleck und ein Megabyte
           HTML.  Gezeigt werden die groessten nach erwartetem Wert – und die
           Zahl steht darunter, damit niemand das Bild fuer vollstaendig haelt. */
        const OBERGRENZE = 400;
        const nachWert = [...pr].sort((a, b) => num(b.kosten_erwartet) - num(a.kosten_erwartet));
        const gezeigteRisiken = nachWert.slice(0, OBERGRENZE);
        const kategorien = [...new Set(pr.map(r => r.kategorie ?? 'ohne Kategorie'))]
          .map((k, i) => ({
            label: k,
            wert: pr.filter(r => (r.kategorie ?? 'ohne Kategorie') === k)
                    .reduce((a, r) => a + num(r.kosten_erwartet), 0),
            farbe: FARBEN[i % FARBEN.length],
          }))
          .filter(k => k.wert > 0).sort((a, b) => b.wert - a.wert);

        return (
          <>
            <div className="card">
              <div className="card-head">
                <div><div className="eyebrow">Streubild</div>
                     <h2>Wahrscheinlichkeit gegen Schadenshöhe</h2></div>
              </div>
              <div className="card-body">
                <StreuChart
                  xLabel="Eintrittswahrscheinlichkeit" yLabel="Schaden (wahrscheinlich)"
                  xEinheit={v => pct(v, 0)}
                  punkte={gezeigteRisiken.map(r => ({
                    x: num(r.wahrscheinlichkeit) * 100,
                    y: num(r.kosten_wahrsch),
                    groesse: num(r.kosten_erwartet),
                    label: `${r.projekt_nr ?? ''} ${r.bezeichnung ?? ''}`.trim(),
                    farbe: num(r.kosten_erwartet) >= 50000 ? '#be123c'
                         : num(r.kosten_erwartet) >= 15000 ? '#b45309' : '#2563eb',
                  }))} />
                <div className="legend">
                  <span><i style={{ background: '#be123c' }} />erwartet ab 50 T€</span>
                  <span><i style={{ background: '#b45309' }} />ab 15 T€</span>
                  <span><i style={{ background: '#2563eb' }} />darunter</span>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Rangfolge</div>
                       <h2>Die größten Einzelrisiken</h2></div>
                </div>
                <div className="card-body">
                  <RangChart zweifarbig={false}
                    zeilen={[...pr].sort((a, b) => num(b.kosten_erwartet) - num(a.kosten_erwartet))
                      .slice(0, 12).map(r => ({
                        label: `${r.projekt_nr ?? '–'} ${r.bezeichnung ?? ''}`.trim(),
                        wert: num(r.kosten_erwartet),
                        hinweis: `${pct(num(r.wahrscheinlichkeit) * 100, 0)} Wahrscheinlichkeit`,
                      }))} />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Erwarteter Schaden je Kategorie</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={kategorien} summenLabel="erwartet" />
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ------------------------------------------ Projektrisiken (PERT) */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Aus den Projekten</div>
            <h2>Projektrisiken nach Drei-Punkt-Schätzung</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Projekt</th><th>Region</th><th>Risiko</th><th>Kategorie</th>
                    <th className="r">Eintritt</th><th className="r">min</th>
                    <th className="r">wahrsch.</th><th className="r">max</th>
                    <th className="r">Erwartungswert</th></tr>
              </thead>
              <tbody>
                {pr.slice(0, 200).map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="mono">{r.projekt_nr}</span>
                      {r.projektname && <div className="muted" style={{ fontSize: 11.5 }}>{r.projektname}</div>}
                    </td>
                    <td className="muted">{r.region}</td>
                    <td>{r.bezeichnung}</td>
                    <td className="muted">{r.kategorie || '–'}</td>
                    <td className="r num">{(Number(r.wahrscheinlichkeit) * 100).toFixed(0)} %</td>
                    <td className="r num muted">{eur0(r.kosten_min)}</td>
                    <td className="r num muted">{eur0(r.kosten_wahrsch)}</td>
                    <td className="r num muted">{eur0(r.kosten_max)}</td>
                    <td className="r num"><b>{eur0(r.kosten_erwartet)}</b></td>
                  </tr>
                ))}
                {!pr.length && (
                  <tr><td colSpan={9}><div className="empty">Kein Risiko passt zum Filter.</div></td></tr>
                )}
                {pr.length > 200 && (
                  <tr><td colSpan={9} className="muted" style={{ padding: 12 }}>
                    … {pr.length - 200} weitere. Zum Eingrenzen die Filter oben nutzen.
                  </td></tr>
                )}
              </tbody>
              {!!pr.length && (
                <tfoot>
                  <tr className="total">
                    <td colSpan={8}>
                      <b>Erwartungswert über {zahl(pr.length)} Risiken in {zahl(prProjekte)} Projekten</b>
                    </td>
                    <td className="r num"><b>{eur0(prErwartet)}</b></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Erfasste Risiken</div>
          <div className="value num">{rows.length}</div>
          <div className="sub">{offen.length} offen</div>
        </div>
        {(['kritisch', 'hoch', 'mittel'] as const).map(s => (
          <div className={`kpi ${s === 'kritisch' ? 'bad' : ''}`} key={s}>
            <div className="label">{s.charAt(0).toUpperCase() + s.slice(1)}</div>
            <div className="value num">{rows.filter(r => stufe(Number(r.risikoscore)).text === s).length}</div>
            <div className="sub">RPZ {s === 'kritisch' ? '≥ 60' : s === 'hoch' ? '30 – 59' : '12 – 29'}</div>
          </div>
        ))}
      </div>

      <RisikoForm projekte={projekte.rows.map(p => ({ id: p.projekt_id, nr: p.projekt_nr, name: p.projektname }))} />

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Register</div><h2>Risikoregister</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Beschreibung</th><th>Projekt</th><th>Kategorie</th>
                  <th className="r">W</th><th className="r">A</th><th className="r">E</th><th className="r">RPZ</th>
                  <th>Einstufung</th><th>Maßnahme</th><th>Verantwortlich</th><th>Frist</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const st = stufe(Number(r.risikoscore));
                  return (
                    <tr key={r.risiko_id}>
                      <td><b>{r.beschreibung}</b></td>
                      <td>{r.projekt_nr
                        ? <><span>{r.projektname}</span><div className="muted mono">{r.projekt_nr}</div></>
                        : <span className="muted">übergreifend</span>}</td>
                      <td className="muted">{r.kategorie || '–'}</td>
                      <td className="r num">{r.wahrscheinlichkeit}</td>
                      <td className="r num">{r.auswirkung}</td>
                      <td className="r num">{r.entdeckbarkeit}</td>
                      <td className="r num"><b>{zahl(r.risikoscore)}</b></td>
                      <td><span className={`chip ${st.klasse}`}>{st.text}</span></td>
                      <td className="muted">{r.massnahme || '–'}</td>
                      <td className="muted">{r.verantwortlicher || '–'}</td>
                      <td className="muted">{datum(r.frist)}</td>
                      <td><span className={`chip ${r.status === 'OFFEN' ? 'warn' : 'pos'}`}>{r.status}</span></td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={12}><div className="empty">Noch keine Risiken erfasst.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
