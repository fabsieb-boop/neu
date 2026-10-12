import Link from 'next/link';
import Shell from '../components/Shell';
import PeriodenWahl from '../components/PeriodenWahl';
import { SaeulenChart, Balken } from '../components/Charts';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../components/RegionsHinweis';
import { geschaeftsjahre, dbRegionen, dbRegionMonate, projektErgebnisse, guvSegmente, letzterBelastbarerMonat, ebitdaRegionen } from '@/lib/queries';
import { zeitraum } from '@/lib/zeitraum';
import { eur0, eurKurz, pct, anteil, vz, zahl, monatKurz, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function RegionenSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('klr.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const fokus = sp.region || '';

  /* Ohne ausdrueckliche Wahl endet die Auswertung beim letzten
     abgeschlossenen Monat – ein angebrochener Monat traegt Kosten,
     aber noch nicht die Erloese. */
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));
  const [regionenAlle, verlauf, segmente, ebitdaRegion] = await Promise.all([
    dbRegionen(jahr, z.von, z.bis), dbRegionMonate(jahr, z.von, z.bis), guvSegmente(jahr),
    ebitdaRegionen(jahr, z.von, z.bis).catch(() => []),
  ]);
  const regionen = nurErlaubteRegionen(regionenAlle, benutzer);
  const projekte = fokus ? await projektErgebnisse(jahr, fokus, z.von, z.bis) : [];

  const monate = [...new Set(verlauf.map(v => v.monat))].sort((a, b) => a - b);
  const leistungGesamt = regionen.reduce((a, r) => a + num(r.leistung), 0);
  const maxLeistung = Math.max(...regionen.map(r => Math.abs(num(r.leistung))), 1);

  const farben = ['#2563eb', '#0d9488', '#7c3aed', '#f59e0b', '#e11d48', '#0891b2'];
  const serien = regionen.map((r, i) => ({
    label: r.region, farbe: farben[i % farben.length],
    werte: monate.map(m => num(verlauf.find(v => v.regionscode === r.regionscode && v.monat === m)?.leistung)),
  }));

  const fokusRegion = regionen.find(r => r.regionscode === fokus);

  return (
    <Shell titel="Regionen" bereich={`${z.text} ${jahr}`} aktiv="regionen" benutzer={benutzer}>
      <div className="card">
        <PeriodenWahl pfad="/regionen" jahre={jahre} jahr={jahr} zeitraum={z}
                      felder={{ region: fokus || undefined }} />
      </div>
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Periodenverlauf</div><h2>Betriebsleistung je Region</h2></div>
        </div>
        <div className="legend">
          {serien.map(s => <span key={s.label}><i style={{ background: s.farbe }} />{s.label}</span>)}
        </div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          <SaeulenChart monate={monate} serien={serien} hoehe={250} />
        </div>
      </div>

      {!!ebitdaRegion.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">GuV je Region</div>
                 <h2>EBITDA je Region</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Region</th><th className="r">Umsatzerlöse</th>
                      <th className="r">Bestandsveränderung</th><th className="r">Gesamtleistung</th>
                      <th className="r">Betriebsaufwand</th><th className="r fix-r">EBITDA</th>
                      <th className="r">Marge</th></tr>
                </thead>
                <tbody>
                  {ebitdaRegion.map(r => {
                    const gl = num(r.gesamtleistung);
                    return (
                      <tr key={r.region}>
                        <td><b>{r.region}</b></td>
                        <td className={`r num ${vz(r.umsatzerloese)}`}>{eur0(r.umsatzerloese)}</td>
                        <td className={`r num ${vz(r.bestandsveraenderung)}`}>{eur0(r.bestandsveraenderung)}</td>
                        <td className={`r num ${vz(gl)}`}>{eur0(gl)}</td>
                        <td className={`r num ${vz(r.betriebsaufwand)}`}>{eur0(r.betriebsaufwand)}</td>
                        <td className={`r num fix-r ${vz(r.ebitda)}`}><b>{eur0(r.ebitda)}</b></td>
                        <td className={`r num ${Math.abs(gl) < 1000 ? 'muted' : vz(num(r.ebitda))}`}>
                          {Math.abs(gl) < 1000 ? '–' : pct((num(r.ebitda) / gl) * 100)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td><b>Gesamt</b></td>
                    <td className="r num">{eur0(ebitdaRegion.map(r => num(r.umsatzerloese)).reduce((a, b) => a + b, 0))}</td>
                    <td className="r num">{eur0(ebitdaRegion.map(r => num(r.bestandsveraenderung)).reduce((a, b) => a + b, 0))}</td>
                    <td className="r num">{eur0(ebitdaRegion.map(r => num(r.gesamtleistung)).reduce((a, b) => a + b, 0))}</td>
                    <td className="r num">{eur0(ebitdaRegion.map(r => num(r.betriebsaufwand)).reduce((a, b) => a + b, 0))}</td>
                    <td className="r num fix-r"><b>{eur0(ebitdaRegion.map(r => num(r.ebitda)).reduce((a, b) => a + b, 0))}</b></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Regionserfolgsrechnung</div>
            <h2>Deckungsbeiträge je Region</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Region</th><th className="r">Projekte</th><th className="r">Leistung</th>
                  <th className="r">var. EK</th><th className="r">DB I</th><th className="r">Proj.-Fix</th>
                  <th className="r">GK-Umlage</th><th className="r">DB III</th>
                  <th className="r">Deckungsdiff.</th><th className="r">DB IV</th><th className="r">Marge</th><th />
                </tr>
              </thead>
              <tbody>
                {regionen.map(r => (
                  <tr key={r.regionscode} style={fokus === r.regionscode ? { background: '#eef4ff' } : undefined}>
                    <td>
                      <Link href={`/regionen?jahr=${jahr}&region=${r.regionscode}`} style={{ color: 'var(--accent)' }}>
                        <b>{r.region}</b>
                      </Link>
                      <div className="muted mono">Code {r.regionscode}</div>
                    </td>
                    <td className="r num">{r.projekte}</td>
                    <td className="r num">{eur0(r.leistung)}</td>
                    <td className="r num">{eur0(r.variable_kosten)}</td>
                    <td className={`r num ${vz(r.db1)}`}>{eur0(r.db1)}</td>
                    <td className="r num">{eur0(r.fixe_projektkosten)}</td>
                    <td className="r num">{eur0(r.verrechnete_gk)}</td>
                    <td className={`r num ${vz(r.db3)}`}><b>{eur0(r.db3)}</b></td>
                    <td className={`r num ${vz(-num(r.bereichs_deckungsdifferenz))}`}>
                      {eur0(r.bereichs_deckungsdifferenz)}
                    </td>
                    <td className={`r num ${vz(r.db4)}`}>{eur0(r.db4)}</td>
                    <td className="r num muted">{num(r.leistung) ? pct(anteil(r.db3, r.leistung) ?? 0) : '–'}</td>
                    <td className="r"><Balken wert={num(r.leistung)} max={maxLeistung} ton="pos" /></td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Gesamt</td>
                  <td className="r num">{regionen.reduce((a, r) => a + num(r.projekte), 0)}</td>
                  <td className="r num">{eur0(leistungGesamt)}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.variable_kosten), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.db1), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.fixe_projektkosten), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.verrechnete_gk), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.db3), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.bereichs_deckungsdifferenz), 0))}</td>
                  <td className="r num">{eur0(regionen.reduce((a, r) => a + num(r.db4), 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!!segmente.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Referenz</div>
              <h2>Segmentergebnisse der BCS-Planung</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr><th>Segment</th><th className="r">Ist</th><th className="r">Forecast</th>
                      <th className="r">Jahr {jahr}</th></tr>
                </thead>
                <tbody>
                  {segmente.map(sg => (
                    <tr key={sg.segment}>
                      <td><b>{sg.segment}</b></td>
                      <td className={`r num ${vz(sg.ist)}`}>{eur0(sg.ist)}</td>
                      <td className={`r num ${vz(sg.fc)}`}>{eur0(sg.fc)}</td>
                      <td className={`r num ${vz(sg.jahr_gesamt)}`}><b>{eur0(sg.jahr_gesamt)}</b></td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Summe</td>
                    <td className="r num">{eur0(segmente.reduce((a, x) => a + num(x.ist), 0))}</td>
                    <td className="r num">{eur0(segmente.reduce((a, x) => a + num(x.fc), 0))}</td>
                    <td className="r num">{eur0(segmente.reduce((a, x) => a + num(x.jahr_gesamt), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {fokusRegion && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Region {fokusRegion.region}</div>
              <h2>Projekte der Region</h2>
            </div>
            <Link className="btn" href={`/regionen?jahr=${jahr}`}>Fokus aufheben</Link>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Projekt</th><th className="r">Leistung</th><th className="r">DB I</th>
                      <th className="r">DB III</th><th className="r">Marge</th><th className="r">Belege</th></tr>
                </thead>
                <tbody>
                  {projekte.map(p => (
                    <tr key={p.projekt_nr}>
                      <td>
                        <Link href={`/projekte/${p.projekt_nr}?jahr=${jahr}`} style={{ color: 'var(--accent)' }}>
                          <b>{p.projektname || p.projekt_nr}</b>
                        </Link>
                        <div className="muted mono">{p.projekt_nr}</div>
                      </td>
                      <td className="r num">{eur0(p.leistung)}</td>
                      <td className={`r num ${vz(p.db1)}`}>{eur0(p.db1)}</td>
                      <td className={`r num ${vz(p.db3)}`}>{eur0(p.db3)}</td>
                      <td className="r num muted">{p.db3_marge === null ? '–' : pct(p.db3_marge)}</td>
                      <td className="r num muted">{zahl(p.belege)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
