import Link from 'next/link';
import Shell from '../components/Shell';
import ErfassungsForm from '../planung/ErfassungsForm';
import StufeWechseln from './StufeWechseln';
import ProjektAusChance from './ProjektAusChance';
import { requireRecht } from '@/lib/guard';
import { chancen, regionenStamm } from '@/lib/queries';
import { eur0, eurKurz, pct, datum, num, zahl } from '@/lib/format';
import { RangChart, RingChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

const STUFEN = [
  { key: 'LEAD',         text: 'Lead',         ton: '' },
  { key: 'QUALIFIZIERT', text: 'Qualifiziert', ton: '' },
  { key: 'ANGEBOT',      text: 'Angebot',      ton: 'info' },
  { key: 'VERHANDLUNG',  text: 'Verhandlung',  ton: 'warn' },
  { key: 'GEWONNEN',     text: 'Gewonnen',     ton: 'pos' },
  { key: 'VERLOREN',     text: 'Verloren',     ton: 'neg' },
] as const;

export default async function PipelineSeite() {
  const benutzer = await requireRecht('forecast.read');
  const [liste, regionen] = await Promise.all([chancen(), regionenStamm()]);

  const s = (rows: typeof liste, f: (c: typeof liste[number]) => unknown) =>
    rows.reduce((a, c) => a + num(f(c)), 0);

  const laufend = liste.filter(c => !['GEWONNEN', 'VERLOREN'].includes(c.stufe));
  const gewonnen = liste.filter(c => c.stufe === 'GEWONNEN');

  /* Aufteilung je Niederlassung, im Schnitt der Ergebnispräsentation
     (Folie 23): Zahl der Angebote, ihr Volumen, und was davon Auftrag
     geworden ist – nach Stück und nach Wert.  Die Niederlassungsnummer
     steht davor, weil die Präsentation und der Vertrieb so darüber reden;
     "Berlin" heißt dort "65. Ost/Mitte". */
  const NL: Record<string, string> = {
    '15': '15. West', '30': '30. Süd-West', '60': '60. Ost', '65': '65. Ost/Mitte',
    '50': '50. Verwaltung',
  };
  const jeNiederlassung = [...new Set(liste.map(c => c.regionscode ?? '—'))]
    .map(rc => {
      const teil = liste.filter(c => (c.regionscode ?? '—') === rc);
      const gew = teil.filter(c => c.stufe === 'GEWONNEN');
      const entschieden = teil.filter(c => ['GEWONNEN', 'VERLOREN'].includes(c.stufe));
      const volumen = s(teil, c => c.umsatz);
      return {
        rc,
        name: NL[rc] ?? (teil[0]?.region ?? 'ohne Zuordnung'),
        angebote: teil.length,
        volumen,
        gewonnen: gew.length,
        gewonnenWert: s(gew, c => c.umsatz),
        /* Zuschlagsquote nach Wert, wie in der Präsentation: was gewonnen
           wurde, gemessen am angebotenen Volumen. */
        quote: volumen > 0 ? (s(gew, c => c.umsatz) / volumen) * 100 : null,
        entschieden: entschieden.length,
      };
    })
    .sort((a, b) => b.volumen - a.volumen);

  /* Vier Status wie auf Folie 25.  "ohne Statuspflege" sind offene Angebote,
     deren Wahrscheinlichkeit noch auf dem Vorgabewert steht – sie sind
     erfasst, aber nicht bewertet. */
  const STATUS = [
    { key: 'beauftragt', label: 'beauftragt',        farbe: '#1e293b' },
    { key: 'bewertet',   label: 'offen (bewertet)',  farbe: '#7ba7d7' },
    { key: 'ungepflegt', label: 'ohne Statuspflege', farbe: '#e0a63a' },
    { key: 'abgesagt',   label: 'abgesagt',          farbe: '#c0392b' },
  ];
  const statusVon = (c: typeof liste[number]) =>
    c.stufe === 'GEWONNEN' ? 'beauftragt'
    : c.stufe === 'VERLOREN' ? 'abgesagt'
    : Number(c.wahrscheinlichkeit) === 0.5 ? 'ungepflegt' : 'bewertet';

  const statusJeNl = jeNiederlassung.map(n => {
    const teil = liste.filter(c => (c.regionscode ?? '—') === n.rc);
    return {
      ...n,
      teile: STATUS.map(st => ({ ...st, anzahl: teil.filter(c => statusVon(c) === st.key).length })),
    };
  });
  const ungepflegt = liste.filter(c => statusVon(c) === 'ungepflegt');

  const topPipeline = [...liste].filter(c => c.stufe === 'ANGEBOT')
    .sort((a, b) => num(b.umsatz) - num(a.umsatz)).slice(0, 8);

  const volumenGesamt = s(liste, c => c.umsatz);
  const gewonnenGesamt = s(gewonnen, c => c.umsatz);

  return (
    <Shell titel="Angebote und Chancen" bereich="Pipeline und gewichteter Auftragseingang"
           aktiv="pipeline" benutzer={benutzer}
           aktion={<span className="chip info">{liste.length} Chancen</span>}>
      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Pipeline gewichtet</div>
          <div className="value num">{eurKurz(s(laufend, c => c.gewichtet))}</div>
          <div className="sub">aus {eurKurz(s(laufend, c => c.umsatz))} Volumen</div>
        </div>
        <div className="kpi good">
          <div className="label">Gewonnen</div>
          <div className="value num">{eurKurz(s(gewonnen, c => c.umsatz))}</div>
          <div className="sub">{gewonnen.length} Chancen</div>
        </div>
        <div className="kpi">
          <div className="label">Trefferquote</div>
          <div className="value num">
            {liste.filter(c => ['GEWONNEN', 'VERLOREN'].includes(c.stufe)).length
              ? pct((gewonnen.length / liste.filter(c => ['GEWONNEN', 'VERLOREN'].includes(c.stufe)).length) * 100)
              : '–'}
          </div>
          <div className="sub">gewonnen von entschieden</div>
        </div>
        <div className="kpi">
          <div className="label">In Verhandlung</div>
          <div className="value num">{eurKurz(s(liste.filter(c => c.stufe === 'VERHANDLUNG'), c => c.umsatz))}</div>
          <div className="sub">{liste.filter(c => c.stufe === 'VERHANDLUNG').length} Chancen</div>
        </div>
      </div>

      {/* ------------------------------------ Aufteilung je Niederlassung
          Dieselbe Ansicht wie auf Folie 23 der Ergebnispräsentation, damit
          niemand zwei Zahlenwerke nebeneinanderhalten muss. */}
      {!!jeNiederlassung.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Angebotslage nach Niederlassungen</div>
              <h2>Angebote, Volumen und was davon Auftrag wurde</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Niederlassung</th><th className="r">Angebote</th>
                      <th className="r">Volumen</th><th className="r">Aufträge</th>
                      <th className="r">Auftragswert</th><th className="r">Zuschlagsquote</th>
                      <th style={{ width: '18%' }}>Anteil am Volumen</th></tr>
                </thead>
                <tbody>
                  {jeNiederlassung.map(n => (
                    <tr key={n.rc}>
                      <td><b>{n.name}</b></td>
                      <td className="r num muted">{zahl(n.angebote)}</td>
                      <td className="r num">{eurKurz(n.volumen)}</td>
                      <td className="r num muted">{zahl(n.gewonnen)}</td>
                      <td className="r num"><b>{eurKurz(n.gewonnenWert)}</b></td>
                      <td className={`r num ${n.quote === null ? 'muted' : n.quote >= 20 ? 'pos' : ''}`}>
                        {n.quote === null ? '–' : pct(n.quote)}
                      </td>
                      <td>
                        <span className="bartrack" style={{ width: '100%' }}>
                          <i className="pos" style={{
                            width: `${volumenGesamt > 0 ? (n.volumen / volumenGesamt) * 100 : 0}%` }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td><b>Gesamt</b></td>
                    <td className="r num">{zahl(liste.length)}</td>
                    <td className="r num"><b>{eurKurz(volumenGesamt)}</b></td>
                    <td className="r num">{zahl(gewonnen.length)}</td>
                    <td className="r num"><b>{eurKurz(gewonnenGesamt)}</b></td>
                    <td className="r num">
                      {volumenGesamt > 0 ? pct((gewonnenGesamt / volumenGesamt) * 100) : '–'}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------- Bilder zur Pipeline */}
      {!!liste.length && (() => {
        const jeRegion = [...new Set(liste.map(c => c.region ?? 'ohne Region'))]
          .map((r, i) => ({
            label: r,
            wert: s(liste.filter(c => (c.region ?? 'ohne Region') === r && !['VERLOREN'].includes(c.stufe)),
                    c => c.gewichtet),
            farbe: FARBEN[i % FARBEN.length],
          }))
          .filter(r => r.wert > 0)
          .sort((a, b) => b.wert - a.wert);

        return (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Trichter</div>
                       <h2>Volumen je Stufe</h2></div>
                </div>
                <div className="card-body">
                  <RangChart zweifarbig={false}
                    zeilen={STUFEN.map(st => ({
                      label: st.text,
                      wert: s(liste.filter(c => c.stufe === st.key), c => c.umsatz),
                      hinweis: `${liste.filter(c => c.stufe === st.key).length} Chancen`,
                    }))} />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Gewichtete Pipeline je Region</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={jeRegion} summenLabel="gewichtet" />
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Angebote 2026 nach Status</div>
                       <h2>Je Niederlassung</h2></div>
                </div>
                <div className="card-body flush">
                  <div className="tablewrap">
                    <table className="data compact">
                      <thead><tr><th>NL</th><th className="r">Angebote</th>
                                 <th style={{ width: '58%' }}>Status</th></tr></thead>
                      <tbody>
                        {statusJeNl.map(n => (
                          <tr key={n.rc}>
                            <td><b>{n.name}</b></td>
                            <td className="r num muted">{zahl(n.angebote)}</td>
                            <td>
                              <span className="stapel">
                                {n.teile.filter(t => t.anzahl > 0).map(t => (
                                  <i key={t.key} style={{ background: t.farbe,
                                                          width: `${(t.anzahl / n.angebote) * 100}%` }}
                                     title={`${t.label}: ${t.anzahl}`}>
                                    {(t.anzahl / n.angebote) >= 0.10 ? String(t.anzahl) : ''}
                                  </i>
                                ))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="legend">
                  {STATUS.map(st => (
                    <span key={st.key}><i style={{ background: st.farbe }} />{st.label}</span>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Top-Pipeline, offene Angebote</div>
                       <h2>Die größten offenen Angebote</h2></div>
                </div>
                <div className="card-body">
                  <RangChart zweifarbig={false} zeilen={topPipeline.map(c => ({
                    label: `${c.kunde} – ${c.bezeichnung}`,
                    wert: num(c.umsatz),
                    hinweis: c.region ?? '',
                  }))} />
                </div>
              </div>
            </div>

            {ungepflegt.length > 0 && (
              <div className="note warn">
                <b>{zahl(ungepflegt.length)} offene Angebote ohne Statuspflege</b>{' '}
                ({eurKurz(s(ungepflegt, c => c.umsatz))} Volumen). Ihre Eintrittswahrscheinlichkeit
                steht noch auf dem Vorgabewert von 50 %. Solange das so ist, ist die gewichtete
                Pipeline genau das halbe Volumen und sagt nichts über die Aussichten.
              </div>
            )}

          </>
        );
      })()}

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Trichter</div><h2>Chancen je Stufe</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr><th>Stufe</th><th className="r">Chancen</th><th className="r">Volumen</th>
                    <th className="r">gewichtet</th><th className="r">Ø Wahrscheinlichkeit</th><th /></tr>
              </thead>
              <tbody>
                {STUFEN.map(st => {
                  const rows = liste.filter(c => c.stufe === st.key);
                  const vol = s(rows, c => c.umsatz);
                  const max = Math.max(...STUFEN.map(x => s(liste.filter(c => c.stufe === x.key), c => c.umsatz)), 1);
                  return (
                    <tr key={st.key}>
                      <td><span className={`chip ${st.ton}`}>{st.text}</span></td>
                      <td className="r num">{rows.length}</td>
                      <td className="r num">{eur0(vol)}</td>
                      <td className="r num"><b>{eur0(s(rows, c => c.gewichtet))}</b></td>
                      <td className="r num muted">
                        {rows.length ? pct((s(rows, c => c.wahrscheinlichkeit) / rows.length) * 100, 0) : '–'}
                      </td>
                      <td className="r">
                        <span className="bartrack">
                          <i className="pos" style={{ width: `${Math.min(100, (vol / max) * 100)}%` }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ErfassungsForm
        modul="chance"
        titel="Chance erfassen"
        knopf="Chance speichern"
        felder={[
          { name: 'kunde', label: 'Kunde', pflicht: true, breite: 200 },
          { name: 'bezeichnung', label: 'Vorhaben', pflicht: true, breite: 240 },
          { name: 'regionscode', label: 'Region', typ: 'select',
            optionen: [{ wert: '', text: '– ohne –' },
              ...regionen.map(r => ({ wert: r.regionscode, text: r.region }))] },
          { name: 'umsatz', label: 'Umsatz €', typ: 'number', pflicht: true },
          { name: 'wahrscheinlichkeit', label: 'Wahrsch. %', typ: 'prozent', vorgabe: 50 },
          { name: 'stufe', label: 'Stufe', typ: 'select', vorgabe: 'LEAD',
            optionen: STUFEN.map(s => ({ wert: s.key, text: s.text })) },
          { name: 'erwarteter_start', label: 'Start', typ: 'date' },
          { name: 'notiz', label: 'Notiz', typ: 'textarea', breite: 220 },
        ]}
      />

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Alle Chancen</div><h2>Pipeline</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr><th>Kunde</th><th>Vorhaben</th><th>Region</th><th className="r">Umsatz</th>
                    <th className="r">Wahrsch.</th><th className="r">gewichtet</th>
                    <th>Start</th><th>Stufe</th><th>Projekt</th></tr>
              </thead>
              <tbody>
                {liste.map(c => (
                  <tr key={c.chance_id}>
                    <td><b>{c.kunde}</b></td>
                    <td>{c.bezeichnung}
                      {c.notiz && <div className="muted" style={{ fontSize: 11.5 }}>{c.notiz}</div>}</td>
                    <td className="muted">{c.region}</td>
                    <td className="r num">{eur0(c.umsatz)}</td>
                    <td className="r num muted">{pct(num(c.wahrscheinlichkeit) * 100, 0)}</td>
                    <td className="r num"><b>{eur0(c.gewichtet)}</b></td>
                    <td className="muted">{datum(c.erwarteter_start)}</td>
                    <td>
                      <StufeWechseln chanceId={c.chance_id} stufe={c.stufe}
                                     wahrscheinlichkeit={num(c.wahrscheinlichkeit)}
                                     kunde={c.kunde} bezeichnung={c.bezeichnung} />
                    </td>
                    <td>
                      {c.projekt_nr
                        ? <Link className="mono" href={`/projekte/${c.projekt_nr}`}
                                style={{ color: 'var(--accent)' }}>{c.projekt_nr}</Link>
                        : c.stufe === 'GEWONNEN'
                          ? <ProjektAusChance chance={{
                              chance_id: c.chance_id, kunde: c.kunde, bezeichnung: c.bezeichnung,
                              regionscode: c.regionscode, umsatz: num(c.umsatz),
                              erwarteter_start: c.erwarteter_start }} />
                          : <span className="muted">–</span>}
                    </td>
                  </tr>
                ))}
                {!liste.length && (
                  <tr><td colSpan={9}><div className="empty">Noch keine Chance erfasst.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
