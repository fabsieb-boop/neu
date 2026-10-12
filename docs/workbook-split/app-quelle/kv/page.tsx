import Link from 'next/link';
import Shell from '../components/Shell';
import RegionsFilter, { filterLesen } from '../components/RegionsFilter';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { kvAbgleich, kvStand } from '@/lib/queries';
import { eur0, eurKurz, pct, vz, zahl, datum, num } from '@/lib/format';
import { RangChart, RingChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

export default async function KvSeite({ searchParams }:
  { searchParams: Promise<Record<string, string>> }) {

  const benutzer = await requireRecht('projects.read');
  const sp = await searchParams;
  const { region: roheRegion, auftrag } = filterLesen(sp);
  const region = regionErzwingen(benutzer, roheRegion);
  const nurLaufend = sp.laufend !== 'nein';

  const [alle, stand] = await Promise.all([kvAbgleich(), kvStand()]);
  const s = stand[0];

  const suche = auftrag.toLowerCase();
  const zeilen = alle.filter(z =>
    (!nurLaufend || z.in_sap) &&
    (!region || z.region === region) &&
    (!suche || z.psp.includes(suche) ||
               (z.auftrag ?? '').toLowerCase().includes(suche) ||
               (z.projekttitel ?? '').toLowerCase().includes(suche) ||
               (z.auftraggeber ?? '').toLowerCase().includes(suche) ||
               (z.bauleiter ?? '').toLowerCase().includes(suche)));

  const vergleichbar = zeilen.filter(z => z.vergleichbar);
  const su = (rows: typeof zeilen, f: (z: typeof zeilen[number]) => unknown) =>
    rows.reduce((a, z) => a + num(f(z)), 0);

  return (
    <Shell titel="Kostenverfolgung gegen SAP" bereich="Was die Regionen führen, was gebucht ist"
           aktiv="kv" benutzer={benutzer}
           aktion={<Link className="btn" href="/projekte">Projekte</Link>}>
      <div className="card">
        <RegionsFilter pfad="/kv" region={region} auftrag={auftrag} erlaubt={benutzer.regionen}
                       auftragLabel="PSP, Titel, Auftraggeber oder Bauleiter"
                       felder={{ laufend: nurLaufend ? undefined : 'nein' }} />
        <div className="card-body" style={{ paddingTop: 0, display: 'flex',
                                            gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {zahl(zeilen.length)} von {zahl(alle.length)} Projekten ·
            davon {zahl(vergleichbar.length)} unmittelbar vergleichbar
            {s && <> · Stand {s.quelle_datei}, eingelesen {datum(s.eingelesen_at)}</>}
          </span>
          <Link className="btn" href={nurLaufend ? '/kv?laufend=nein' : '/kv'}>
            {nurLaufend ? 'auch Projekte ohne SAP-Buchung zeigen' : 'nur mit SAP-Buchungen'}
          </Link>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Umsatz laut Verfolgung</div>
          <div className="value num">{eurKurz(su(zeilen, z => z.umsatz_kv))}</div>
          <div className="sub">SAP: {eurKurz(su(zeilen, z => z.umsatz_sap))}</div>
        </div>
        <div className="kpi">
          <div className="label">Kosten laut Verfolgung</div>
          <div className="value num">{eurKurz(su(zeilen, z => z.kosten_kv))}</div>
          <div className="sub">SAP: {eurKurz(su(zeilen, z => z.kosten_sap))}</div>
        </div>
        <div className="kpi">
          <div className="label">Delta Ergebnis</div>
          <div className="value num">{eurKurz(su(zeilen, z => z.ergebnis_delta))}</div>
          <div className="sub">über alle gezeigten Projekte</div>
        </div>
        <div className="kpi good">
          <div className="label">Delta der vergleichbaren</div>
          <div className="value num">{eurKurz(su(vergleichbar, z => z.ergebnis_delta))}</div>
          <div className="sub">{zahl(vergleichbar.length)} Projekte aus diesem Jahr</div>
        </div>
      </div>

      {!!vergleichbar.length && (() => {
        /* Die Frage dieser Seite ist eine Abweichungsfrage: wo laufen die
           eigene Verfolgung und SAP auseinander?  Eine Liste beantwortet das
           erst nach dem Durchlesen, ein Streubild sofort. */
        const nachDelta = [...vergleichbar]
          .sort((a, b) => Math.abs(num(b.ergebnis_delta)) - Math.abs(num(a.ergebnis_delta)));
        const jeRegion = [...new Set(vergleichbar.map(z => z.region ?? 'ohne Region'))]
          .map((r, i) => ({
            label: r, farbe: FARBEN[i % FARBEN.length],
            wert: Math.abs(su(vergleichbar.filter(z => (z.region ?? 'ohne Region') === r),
                              z => z.ergebnis_delta)),
          }))
          .filter(r => r.wert > 0).sort((a, b) => b.wert - a.wert);

        return (
          <>
            {/* Das Streubild an dieser Stelle trug Erfuellungsgrad gegen Ergebnis
                auf und liess die Abweichung nur als Blasengroesse erkennen – die
                Frage der Seite beantwortete es damit nicht.  Gefragt ist, welche
                beiden Zahlen auseinanderlaufen und um wie viel.  Also stehen sie
                jetzt nebeneinander, mit dem Abstand als Balken um die Null. */}
            <div className="card">
              <div className="card-head">
                <div><div className="eyebrow">Gegenüberstellung</div>
                     <h2>Verfolgung gegen SAP</h2></div>
              </div>
              <div className="card-body flush">
                <div className="tablewrap">
                  <table className="data compact">
                    <thead><tr>
                      <th>Projekt</th>
                      <th className="r">Erfüllung</th>
                      <th className="r">Verfolgung</th>
                      <th className="r">SAP</th>
                      <th className="r">Abweichung</th>
                      <th>SAP mehr &nbsp;·&nbsp; Verfolgung mehr</th>
                    </tr></thead>
                    <tbody>
                      {(() => {
                        const oben = nachDelta.slice(0, 20);
                        const maxAbw = Math.max(...oben.map(z => Math.abs(num(z.ergebnis_delta))), 1);
                        return oben.map(z => {
                          const d = num(z.ergebnis_delta);
                          const anteil = (Math.abs(d) / maxAbw) * 50;   // halbe Breite je Seite
                          return (
                            <tr key={z.psp}>
                              <td><b>{z.psp}</b>
                                  {z.projekttitel && <span className="formula">{z.projekttitel}</span>}</td>
                              <td className="r num muted">{pct(z.erfuellung_prozent, 0)}</td>
                              <td className={`r num ${vz(z.ergebnis_kv)}`}>{eur0(z.ergebnis_kv)}</td>
                              <td className={`r num ${vz(z.ergebnis_sap)}`}>{eur0(z.ergebnis_sap)}</td>
                              <td className={`r num ${vz(d)}`}><b>{eur0(d)}</b></td>
                              <td style={{ width: '26%' }}>
                                <span className="abw">
                                  <i className={d >= 0 ? 'pos' : 'neg'}
                                     style={d >= 0
                                       ? { left: '50%', width: `${anteil}%` }
                                       : { right: '50%', width: `${anteil}%` }} />
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Rangfolge</div>
                       <h2>Größte Abweichungen im Ergebnis</h2></div>
                </div>
                <div className="card-body">
                  <RangChart zeilen={nachDelta.slice(0, 14).map(z => ({
                    label: `${z.psp} ${z.projekttitel ?? ''}`.trim(),
                    wert: num(z.ergebnis_delta),
                    hinweis: `Verfolgung ${eurKurz(z.ergebnis_kv)} · SAP ${eurKurz(z.ergebnis_sap)}`,
                  }))} />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Abweichung je Region</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={jeRegion} summenLabel="Abweichung" />
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Je Projekt</div><h2>Abgleich</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>PSP</th><th>Projekt</th><th>Region</th><th>Bauleiter</th><th>Phase</th>
                    <th className="r">Umsatz KV</th><th className="r">Umsatz SAP</th>
                    <th className="r">Kosten KV</th><th className="r">Kosten SAP</th>
                    <th className="r">Δ Ergebnis</th></tr>
              </thead>
              <tbody>
                {zeilen.slice(0, 200).map(z => (
                  <tr key={z.psp} className={z.vergleichbar ? undefined : 'mehrjaehrig'}>
                    <td className="num">
                      {z.auftrag
                        ? <Link href={`/projekte/${z.auftrag}`}>{z.psp}</Link>
                        : z.psp}
                      {z.vergleichbar && <span className="chip pos" style={{ marginLeft: 6 }}>{new Date().getFullYear()}</span>}
                    </td>
                    <td>{z.projekttitel || '–'}
                      {z.auftraggeber && <div className="muted" style={{ fontSize: 11.5 }}>{z.auftraggeber}</div>}
                    </td>
                    <td className="muted">{z.region}</td>
                    <td className="muted">{z.bauleiter || '–'}</td>
                    <td className="muted">{z.phase || '–'}</td>
                    <td className="r num">{eur0(z.umsatz_kv)}</td>
                    <td className="r num">{eur0(z.umsatz_sap)}</td>
                    <td className="r num">{eur0(z.kosten_kv)}</td>
                    <td className="r num">{eur0(z.kosten_sap)}</td>
                    <td className={`r num ${vz(num(z.ergebnis_delta))}`}>
                      <b>{eur0(z.ergebnis_delta)}</b>
                    </td>
                  </tr>
                ))}
                {!zeilen.length && (
                  <tr><td colSpan={10}><div className="empty">Kein Projekt passt zum Filter.</div></td></tr>
                )}
                {zeilen.length > 200 && (
                  <tr><td colSpan={10} className="muted" style={{ padding: 12 }}>
                    … {zahl(zeilen.length - 200)} weitere. Zum Eingrenzen die Filter oben nutzen.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-body">
          <span className="muted" style={{ fontSize: 12.5 }}>
            Grau hinterlegte Zeilen sind mehrjährige Projekte – dort enthält die
            Kostenverfolgung Vorjahre, die im SAP-Auszug fehlen.
          </span>
        </div>
      </div>
    </Shell>
  );
}
