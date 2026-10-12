import Link from 'next/link';
import Shell from '../../components/Shell';
import RegionsFilter, { filterLesen } from '../../components/RegionsFilter';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { planJahre, planRegionen, planIst, planReihe, geschaeftsjahre } from '@/lib/queries';
import { eur0, eurKurz, pct, vz, zahl, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PlanKontenSeite({ searchParams }:
  { searchParams: Promise<Record<string, string>> }) {

  const benutzer = await requireRecht('forecast.read');
  const sp = await searchParams;
  const { region: roheRegion, auftrag: kontosuche } = filterLesen(sp);
  const region = regionErzwingen(benutzer, roheRegion);

  const [jahre, istJahre] = await Promise.all([planJahre(), geschaeftsjahre()]);
  if (!jahre.length) {
    return (
      <Shell titel="Mehrjahresplanung" bereich="je Region und Konto" aktiv="planung" benutzer={benutzer}>
        <div className="note warn">
          <b>Noch keine Planung eingelesen.</b> Die Mappe
          <code> Jahresplanung_NL-Kostenstellen_*.xlsx</code> wird mit
          <code> npm run db:planung</code> geladen.
        </div>
      </Shell>
    );
  }

  const planjahr = Number(sp.planjahr) || jahre[0].jahr;
  const istjahr  = Number(sp.istjahr)  || istJahre[0] || 2026;

  const [regionen, reihe, zeilen] = await Promise.all([
    planRegionen(planjahr), planReihe(), planIst(planjahr, istjahr),
  ]);

  const suche = kontosuche.toLowerCase();
  const gefiltert = zeilen.filter(z =>
    (!region || z.region === region) &&
    (!suche || z.konto.toLowerCase().includes(suche) ||
               (z.kontobezeichnung ?? '').toLowerCase().includes(suche) ||
               (z.gruppe ?? '').toLowerCase().includes(suche)));

  const s = (f: (z: typeof zeilen[number]) => unknown, art?: string) =>
    gefiltert.filter(z => !art || z.art === art).reduce((a, z) => a + num(f(z)), 0);

  const planErtrag  = s(z => z.plan, 'Erlöse');
  const planAufwand = s(z => z.plan, 'Aufwand');
  const istErtrag   = s(z => z.ist, 'Erlöse');
  const istAufwand  = s(z => z.ist, 'Aufwand');

  const planjahre = [...new Set(reihe.map(r => r.jahr))].sort();

  return (
    <Shell titel="Mehrjahresplanung" bereich={`Plan ${planjahr} gegen Ist ${istjahr}`}
           aktiv="planung" benutzer={benutzer}
           aktion={<Link className="btn" href="/guv">GuV je Region</Link>}>
      {/* -------------------------------------------------- Auswahl */}
      <div className="card">
        <form className="toolbar" method="get" action="/planung/konten">
          <div className="field">
            <label htmlFor="planjahr">Planjahr</label>
            <select id="planjahr" name="planjahr" defaultValue={String(planjahr)}>
              {jahre.map(j => <option key={j.jahr} value={j.jahr}>{j.jahr}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="istjahr">Ist-Jahr</label>
            <select id="istjahr" name="istjahr" defaultValue={String(istjahr)}>
              {istJahre.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          {!!region && <input type="hidden" name="region" value={region} />}
          {!!kontosuche && <input type="hidden" name="auftrag" value={kontosuche} />}
          <button className="btn primary" type="submit">Anzeigen</button>
        </form>
        <RegionsFilter erlaubt={benutzer.regionen} pfad="/planung/konten" region={region} auftrag={kontosuche}
                       auftragLabel="Konto, Bezeichnung oder Gruppe"
                       felder={{ planjahr, istjahr }} />
        <div className="card-body" style={{ paddingTop: 0 }}>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {zahl(gefiltert.length)} von {zahl(zeilen.length)} Konten
            {region && <> · Region <b>{region}</b></>}
            {kontosuche && <> · Suche <b>{kontosuche}</b></>}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------- Kopfzahlen */}
      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Plan {planjahr} Ertrag</div>
          <div className="value num">{eurKurz(planErtrag)}</div>
          <div className="sub">Ist {istjahr}: {eurKurz(istErtrag)}</div>
        </div>
        <div className="kpi">
          <div className="label">Plan {planjahr} Aufwand</div>
          <div className="value num">{eurKurz(planAufwand)}</div>
          <div className="sub">Ist {istjahr}: {eurKurz(istAufwand)}</div>
        </div>
        <div className={`kpi ${planErtrag - planAufwand >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Plan-Ergebnis {planjahr}</div>
          <div className="value num">{eurKurz(planErtrag - planAufwand)}</div>
          <div className="sub">
            {planErtrag ? pct(((planErtrag - planAufwand) / planErtrag) * 100) + ' Marge' : '–'}
          </div>
        </div>
        <div className={`kpi ${istErtrag - istAufwand >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Ist-Ergebnis {istjahr}</div>
          <div className="value num">{eurKurz(istErtrag - istAufwand)}</div>
          <div className="sub">Abstand {eurKurz((planErtrag - planAufwand) - (istErtrag - istAufwand))}</div>
        </div>
      </div>

      {/* -------------------------------------------------- Mehrjahresreihe */}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Der Pfad</div><h2>Planergebnis je Region über die Jahre</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Region</th>{planjahre.map(j => <th key={j} className="r">{j}</th>)}</tr>
              </thead>
              <tbody>
                {regionen.map(r => (
                  <tr key={r.region}>
                    <td><b>{r.region}</b></td>
                    {planjahre.map(j => {
                      const z = reihe.find(x => x.jahr === j && x.region === r.region);
                      return (
                        <td key={j} className={`r num ${vz(num(z?.ergebnis))}`}>
                          {z?.ergebnis != null ? eur0(z.ergebnis) : '–'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="total">
                  <td>Konzern</td>
                  {planjahre.map(j => (
                    <td key={j} className="r num">
                      <b>{eur0(reihe.filter(x => x.jahr === j)
                                    .reduce((a, x) => a + num(x.ergebnis), 0))}</b>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- Konten */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Plan gegen Ist</div>
            <h2>Je Konto</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Konto</th><th>Bezeichnung</th><th>Region</th><th>Gruppe</th><th>Art</th>
                    <th className="r">Plan {planjahr}</th><th className="r">Ist {istjahr}</th>
                    <th className="r">Abstand</th><th className="r">%</th></tr>
              </thead>
              <tbody>
                {gefiltert.slice(0, 250).map(z => (
                  <tr key={`${z.region}-${z.konto}`}>
                    <td className="num">{z.konto}</td>
                    <td>{z.kontobezeichnung || '–'}</td>
                    <td className="muted">{z.region}</td>
                    <td className="muted">{z.gruppe || '–'}</td>
                    <td><span className={`chip ${z.art === 'Erlöse' ? 'pos' : 'info'}`}>{z.art}</span></td>
                    <td className="r num">{num(z.plan) ? eur0(z.plan) : '–'}</td>
                    <td className="r num">{num(z.ist) ? eur0(z.ist) : '–'}</td>
                    <td className={`r num ${vz(-num(z.abweichung))}`}><b>{eur0(z.abweichung)}</b></td>
                    <td className="r num muted">
                      {z.abweichung_prozent != null ? pct(num(z.abweichung_prozent)) : '–'}
                    </td>
                  </tr>
                ))}
                {!gefiltert.length && (
                  <tr><td colSpan={9}><div className="empty">Kein Konto passt zum Filter.</div></td></tr>
                )}
                {gefiltert.length > 250 && (
                  <tr><td colSpan={9} className="muted" style={{ padding: 12 }}>
                    … {zahl(gefiltert.length - 250)} weitere. Zum Eingrenzen die Filter oben nutzen.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
