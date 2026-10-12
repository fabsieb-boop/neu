import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';
import { geschaeftsjahre, guvStaffelJahr, guvFiMonat } from '@/lib/queries';
import { eur0, pct, zahl, num, MONATE } from '@/lib/format';

export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------------
   Folienwerte
   ---------------------------------------------------------------------------
   Jede Zahl, die in der Ergebnispräsentation steht, mit drei Angaben: was das
   Dashboard heute rechnet, was auf der Folie steht, und woher der Wert kommt.

   Der Sinn ist nicht Kontrolle um ihrer selbst willen.  Wer vor dem Vorstand
   sitzt und gefragt wird "wo kommt die Zahl her", soll nicht in eine Excel
   greifen müssen.  Und wer die Präsentation neu baut, sieht auf einen Blick,
   welche Folie nachzuziehen ist.

   Die Sollwerte sind der Stand der PPTX vom Juli 2026.  Ändert sich die
   Präsentation, gehören sie hier nachgezogen – sonst meldet die Seite eine
   Abweichung, die keine ist.
--------------------------------------------------------------------------- */

type Zeile = {
  folie: string;
  kennzahl: string;
  /** Wert lt. PPTX */
  soll: number | null;
  toleranz: number;
  /** 'eur' T€ · 'meur' M€ · 'pct' Anteil */
  einheit: 'eur' | 'meur' | 'pct';
  herkunft: string;
  /** null = im Dashboard nicht geführt */
  ist: number | null;
};

export default async function FolienwerteSeite(
  { searchParams }: { searchParams: Promise<Record<string, string>> },
) {
  const benutzer = await requireRecht('finance.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || 2026;

  const [staffel, ausSap] = await Promise.all([
    guvStaffelJahr(jahr).catch(() => []),
    /* Gegenprobe: dieselbe Staffel, aber aus den Buchungen gerechnet. */
    guvFiMonat(jahr).catch(() => []),
  ]);

  if (!staffel.length) {
    return (
      <Shell titel="Folienwerte" bereich={`Ergebnispräsentation ${jahr}`}
             aktiv="folienwerte" benutzer={benutzer}>
        <div className="note warn">
          <b>Für {jahr} liegt keine Ergebnisreihe vor.</b> Die Seite rechnet aus der
          GuV-Staffel; ohne sie gibt es nichts zu vergleichen.
        </div>
      </Shell>
    );
  }

  /* Spalten wie in der Excel: YTD sind die abgerechneten Monate, Jahr ist
     Ist plus Forecast. */
  const ytd  = staffel.filter(z => z.art === 'IST');
  const alle = staffel;
  const m = (nr: number) => staffel.find(z => num(z.monat) === nr);

  const s = (rows: typeof staffel, f: (z: typeof staffel[number]) => unknown) =>
    rows.map(z => num(f(z))).reduce((a, b) => a + b, 0) / 1000;
  const t = (v: unknown) => num(v) / 1000;

  const letzterIst = Math.max(...ytd.map(z => num(z.monat)));
  const juli = m(7), okt = m(10);

  const glYtd    = s(ytd, z => z.gesamtleistung);
  const glJahr   = s(alle, z => z.gesamtleistung);
  const ebYtd    = s(ytd, z => z.ebitda);
  const ebJahr   = s(alle, z => z.ebitda);
  const planGlYtd  = s(ytd, z => z.gl_plan);
  const planEbYtd  = s(ytd, z => z.ebitda_plan);
  const planEbJahr = s(alle, z => z.ebitda_plan);
  const bewJahr  = s(alle, z => num(z.bewertung_gebucht) + num(z.bewertung_offen));
  const bewYtd   = s(ytd, z => num(z.bewertung_gebucht) + num(z.bewertung_offen));
  const vorBewJahr = s(alle, z => z.ebitda_vor_bewertung);
  const restMonate = alle.filter(z => num(z.monat) > letzterIst);

  const H_GUV  = 'ebitda_monat · Blatt „GuV 2026“, eingespielt mit db/38_ergebnisstand_0826.sql';
  const H_LIQ  = 'liq_monat · Jan–Jul aus den SAP-Einzelposten, ab Aug Forecast der Präsentation';
  const H_PLAN = 'plan_monat · Monatsplan 2026, db/39_monatsplan_2026.sql';
  const H_BEW  = 'verlustbewertung · Stand 08/2026 (Folie 20)';

  const zeilen: Zeile[] = [
    { folie: '2 / 11',      kennzahl: 'EBITDA IST+FC 2026',            soll: 210,    toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: ebJahr },
    { folie: '2 / 11 / 12', kennzahl: 'EBITDA YTD',                    soll: -123,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: ebYtd },
    { folie: '2 / 11 / 12', kennzahl: 'Gesamtleistung YTD',            soll: 14.3,   toleranz: 0.05, einheit: 'meur', herkunft: H_LIQ,  ist: glYtd / 1000 },
    { folie: '11',          kennzahl: 'Plan EBITDA YTD',               soll: 477,    toleranz: 3,    einheit: 'eur',  herkunft: H_PLAN, ist: planEbYtd },
    { folie: '11',          kennzahl: 'Δ EBITDA YTD zu Plan',          soll: -600,   toleranz: 6,    einheit: 'eur',  herkunft: `${H_GUV} · ${H_PLAN}`, ist: ebYtd - planEbYtd },
    { folie: '11',          kennzahl: 'Plan Gesamtleistung YTD',       soll: 9.8,    toleranz: 0.05, einheit: 'meur', herkunft: H_PLAN, ist: planGlYtd / 1000 },
    { folie: '11',          kennzahl: 'Gesamtleistung YTD vs. Plan',   soll: 0.46,   toleranz: 0.005, einheit: 'pct', herkunft: `${H_LIQ} · ${H_PLAN}`, ist: planGlYtd ? glYtd / planGlYtd - 1 : 0 },
    { folie: '11 / 18',     kennzahl: 'EBITDA Plan Jahr',              soll: 1000,   toleranz: 3,    einheit: 'eur',  herkunft: H_PLAN, ist: planEbJahr },
    { folie: '11',          kennzahl: 'Verlustfreie Bewertung Jahr',   soll: -740,   toleranz: 3,    einheit: 'eur',  herkunft: H_BEW,  ist: bewJahr },
    { folie: '11 Chart',    kennzahl: 'EBITDA Juli',                   soll: -495,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: t(juli?.ebitda) },
    { folie: '11 Chart',    kennzahl: 'EBITDA Oktober',                soll: -142,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: t(okt?.ebitda) },
    { folie: '12',          kennzahl: 'Umsatzerlöse Juli',             soll: 1324,   toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: t(juli?.umsatz) },
    { folie: '12',          kennzahl: 'Umsatzerlöse YTD',              soll: 10450,  toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: s(ytd, z => z.umsatz) },
    { folie: '12',          kennzahl: 'Bestandsveränderung Juli',      soll: 295,    toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: t(juli?.bestandsaenderung) },
    { folie: '12',          kennzahl: 'Bestandsveränderung YTD',       soll: 3886,   toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: s(ytd, z => z.bestandsaenderung) },
    { folie: '12',          kennzahl: 'Gesamtleistung Juli',           soll: 1619,   toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: t(juli?.gesamtleistung) },
    { folie: '12',          kennzahl: 'Gesamtleistung YTD',            soll: 14337,  toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: glYtd },
    { folie: '12',          kennzahl: 'Operatives Ergebnis Juli',      soll: -40,    toleranz: 3,    einheit: 'eur',  herkunft: 'nachrichtlich · nicht additiv, im Dashboard nicht geführt', ist: null },
    { folie: '12',          kennzahl: 'Operatives Ergebnis YTD',       soll: 1143,   toleranz: 3,    einheit: 'eur',  herkunft: 'nachrichtlich · nicht additiv, im Dashboard nicht geführt', ist: null },
    { folie: '12',          kennzahl: 'Overhead Juli',                 soll: -122,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: t(juli?.overhead) },
    { folie: '12',          kennzahl: 'Overhead YTD',                  soll: -957,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: s(ytd, z => z.overhead) },
    { folie: '12',          kennzahl: 'Verlustfreie Bewertung Juli',   soll: -373,   toleranz: 3,    einheit: 'eur',  herkunft: H_BEW,  ist: t(num(juli?.bewertung_gebucht) + num(juli?.bewertung_offen)) },
    { folie: '12',          kennzahl: 'Verlustfreie Bewertung YTD',    soll: -447,   toleranz: 3,    einheit: 'eur',  herkunft: H_BEW,  ist: bewYtd },
    { folie: '12',          kennzahl: 'EBITDA Juli',                   soll: -496,   toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: t(juli?.ebitda) },
    { folie: '12',          kennzahl: 'EBITDA-Marge Juli',             soll: -0.31,  toleranz: 0.005, einheit: 'pct', herkunft: H_GUV,  ist: num(juli?.gesamtleistung) ? num(juli?.ebitda) / num(juli?.gesamtleistung) : 0 },
    { folie: '12',          kennzahl: 'EBITDA-Marge YTD',              soll: -0.009, toleranz: 0.005, einheit: 'pct', herkunft: H_GUV,  ist: glYtd ? ebYtd / glYtd : 0 },
    { folie: '12',          kennzahl: 'Plan Gesamtleistung Juli',      soll: 1551,   toleranz: 3,    einheit: 'eur',  herkunft: H_PLAN, ist: t(juli?.gl_plan) },
    { folie: '12',          kennzahl: 'Plan Gesamtleistung YTD',       soll: 9842,   toleranz: 3,    einheit: 'eur',  herkunft: H_PLAN, ist: planGlYtd },
    { folie: '12',          kennzahl: 'Δ Gesamtleistung YTD',          soll: 4495,   toleranz: 3,    einheit: 'eur',  herkunft: `${H_LIQ} · ${H_PLAN}`, ist: glYtd - planGlYtd },
    { folie: '12',          kennzahl: 'Plan EBITDA Juli',              soll: 178,    toleranz: 3,    einheit: 'eur',  herkunft: H_PLAN, ist: t(juli?.ebitda_plan) },
    { folie: '18',          kennzahl: 'Gesamtleistung Jahr IST+FC',    soll: 24923,  toleranz: 3,    einheit: 'eur',  herkunft: H_LIQ,  ist: glJahr },
    { folie: '18',          kennzahl: 'EBITDA vor Bewertung Jahr',     soll: 950,    toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: vorBewJahr },
    { folie: '18 / 26',     kennzahl: 'EBITDA Jahr IST+FC',            soll: 210,    toleranz: 3,    einheit: 'eur',  herkunft: H_GUV,  ist: ebJahr },
    { folie: '18',          kennzahl: 'Δ EBITDA Jahr zu Plan',         soll: -790,   toleranz: 3,    einheit: 'eur',  herkunft: `${H_GUV} · ${H_PLAN}`, ist: ebJahr - planEbJahr },
    { folie: '26',          kennzahl: `Umsatz ab ${letzterIst + 1}/${jahr}`, soll: 17.2, toleranz: 0.05, einheit: 'meur', herkunft: H_LIQ, ist: s(restMonate, z => z.umsatz) / 1000 },
    { folie: '26',          kennzahl: `Bestandsabbau ab ${letzterIst + 1}/${jahr}`, soll: 6.6, toleranz: 0.05, einheit: 'meur', herkunft: H_LIQ, ist: -s(restMonate, z => z.bestandsaenderung) / 1000 },
  ];

  const wert = (v: number | null, e: Zeile['einheit']) =>
    v === null ? '–'
    : e === 'pct'  ? pct(v * 100)
    : e === 'meur' ? `${v.toFixed(2).replace('.', ',')} M€`
    : `${Math.round(v).toLocaleString('de-DE')} T€`;

  const bewertet = zeilen.map(z => {
    const abw = z.ist === null || z.soll === null ? null : z.ist - z.soll;
    return { ...z, abw, stimmt: abw === null ? null : Math.abs(abw) <= z.toleranz };
  });

  const abweichend = bewertet.filter(z => z.stimmt === false);
  const offen = bewertet.filter(z => z.stimmt === null);
  const folien = [...new Set(bewertet.map(z => z.folie))];

  return (
    <Shell titel="Folienwerte" bereich={`Januar bis ${MONATE[letzterIst]} ${jahr}`}
           aktiv="folienwerte" benutzer={benutzer}
           aktion={<span className={`chip ${abweichend.length ? 'neg' : 'pos'}`}>
                     {abweichend.length
                       ? `${abweichend.length} von ${bewertet.length} weichen ab`
                       : `alle ${bewertet.length} stimmen`}
                   </span>}>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Für den Vorstandstermin</div>
            <h2>Jede Zahl der Präsentation, mit ihrer Herkunft</h2>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className={`kpi ${abweichend.length ? 'bad' : 'good'}`}>
          <div className="label">Abweichungen</div>
          <div className="value num">{zahl(abweichend.length)}</div>
          <div className="sub">von {zahl(bewertet.length)} geprüften Folienwerten</div>
        </div>
        <div className="kpi good">
          <div className="label">EBITDA {jahr}</div>
          <div className="value num">{Math.round(ebJahr).toLocaleString('de-DE')} T€</div>
          <div className="sub">Ist bis {letzterIst}/{jahr} und Forecast, nach Bewertung</div>
        </div>
        <div className="kpi">
          <div className="label">EBITDA Jan–{letzterIst}</div>
          <div className="value num">{Math.round(ebYtd).toLocaleString('de-DE')} T€</div>
          <div className="sub">Gesamtleistung {(glYtd / 1000).toFixed(2).replace('.', ',')} M€</div>
        </div>
        <div className="kpi">
          <div className="label">Nicht geführt</div>
          <div className="value num">{zahl(offen.length)}</div>
          <div className="sub">Werte, die das Dashboard bewusst nicht rechnet</div>
        </div>
      </div>

      {abweichend.length > 0 && (
        <div className="note warn">
          <b>{abweichend.length} Werte weichen ab.</b>
        </div>
      )}

      {!!ausSap.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Gegenprobe</div>
              <h2>Dieselbe Staffel, gerechnet aus den SAP-Einzelposten</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>in T€</th>
                      {ausSap.map(z => (
                        <th key={z.monat} className="r">
                          {num(z.monat)}/{String(jahr).slice(2)}
                          {num(z.monat) > letzterIst && <span className="offen"> läuft</span>}
                        </th>
                      ))}
                      <th className="r fix-r">bis {letzterIst}/{String(jahr).slice(2)}</th></tr>
                </thead>
                <tbody>
                  {([
                    ['Umsatzerlöse', (z: typeof ausSap[number]) => z.umsatzerloese],
                    ['Sonstige betriebliche Erträge', (z: typeof ausSap[number]) => z.sonstige_ertraege],
                    ['Bestandsveränderung', (z: typeof ausSap[number]) => z.bestandsveraenderung],
                    ['Betriebsaufwand', (z: typeof ausSap[number]) => z.betriebsaufwand],
                  ] as const).map(([name, f]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      {ausSap.map(z => (
                        <td key={z.monat}
                            className={`r num ${num(z.monat) > letzterIst ? 'muted' : ''}`}>
                          {Math.round(num(f(z)) / 1000).toLocaleString('de-DE')}
                        </td>
                      ))}
                      <td className="r num fix-r">
                        {Math.round(ausSap.filter(z => num(z.monat) <= letzterIst)
                                          .reduce((a, z) => a + num(f(z)), 0) / 1000).toLocaleString('de-DE')}
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td><b>= EBITDA</b></td>
                    {ausSap.map(z => (
                      <td key={z.monat}
                          className={`r num ${num(z.monat) > letzterIst ? 'muted' : ''}`}>
                        <b>{Math.round(num(z.ebitda) / 1000).toLocaleString('de-DE')}</b>
                      </td>
                    ))}
                    <td className="r num fix-r">
                      <b>{Math.round(ausSap.filter(z => num(z.monat) <= letzterIst)
                                           .reduce((a, z) => a + num(z.ebitda), 0) / 1000).toLocaleString('de-DE')}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-body">
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              <b>Bis {letzterIst}/{jahr} auf den Euro, danach Forecast.</b> Ein Monat, der noch
              läuft, ist grau gesetzt und zählt in keiner Summe mit – vor dem Monatsabschluss
              gibt es keine genaue Zahl, nur einen Zwischenstand. Die innerbetriebliche
              Verrechnung bleibt außen vor: sie hebt sich über alle Kostenstellen auf,
              verzerrt aber jeden einzelnen Monat.
              Zuordnung der Konten unter{' '}
              <Link href="/kostenarten" style={{ color: 'var(--accent)' }}>Kostenartenstamm</Link>.
            </p>
          </div>
        </div>
      )}

      {folien.map(f => (
        <div className="card" key={f}>
          <div className="card-head">
            <div><div className="eyebrow">Folie {f}</div>
                 <h2>{bewertet.filter(z => z.folie === f).length} Werte</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Kennzahl</th><th className="r">Dashboard</th><th className="r">Folie</th>
                      <th className="r">Abweichung</th><th>Status</th><th>Herkunft</th></tr>
                </thead>
                <tbody>
                  {bewertet.filter(z => z.folie === f).map(z => (
                    <tr key={z.kennzahl}>
                      <td><b>{z.kennzahl}</b></td>
                      <td className="r num">{wert(z.ist, z.einheit)}</td>
                      <td className="r num muted">{wert(z.soll, z.einheit)}</td>
                      <td className="r num">
                        {z.abw === null ? '–' : wert(z.abw, z.einheit)}
                      </td>
                      <td>
                        {z.stimmt === null
                          ? <span className="chip">nicht geführt</span>
                          : z.stimmt
                            ? <span className="chip pos">stimmt</span>
                            : <span className="chip neg">klären</span>}
                      </td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{z.herkunft}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Aufriss der einzelnen Zahlen: die GuV-Staffel unter{' '}
            <Link href="/guv" style={{ color: 'var(--accent)' }}>GuV</Link>, die Bewertung unter{' '}
            <Link href="/pruefung" style={{ color: 'var(--accent)' }}>Selbstprüfung</Link>, der
            Plan unter <Link href="/forecast" style={{ color: 'var(--accent)' }}>Forecast</Link>.
            Geschäftsjahr wechseln:{' '}
            {jahre.map(j => (
              <Link key={j} href={`/folienwerte?jahr=${j}`}
                    style={{ color: 'var(--accent)', marginRight: 8 }}>{j}</Link>
            ))}
          </p>
        </div>
      </div>
    </Shell>
  );
}
