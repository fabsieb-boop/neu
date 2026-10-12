import Link from 'next/link';
import Shell from '../components/Shell';
import Unterseiten from '../components/Unterseiten';
import { LinienChart, SaeulenChart, WasserfallChart } from '../components/Charts';
import { requireRecht } from '@/lib/guard';
import { liqGrunddaten, bankMonatssummen, faelligkeiten, offenePostenKennzahlen,
         geplanteZahlungen, istZahlungen } from '@/lib/queries';
import {
  rechne, kalibriere, reichweite, versatz, STANDARDSZENARIEN,
} from '@/lib/liquiditaet';
import { eur0, eurKurz, pct, vz, monat as monatName, monatKurz, zahl, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const UNTERSEITEN = [
  { key: 'ueberblick', label: 'Überblick', href: '/liquiditaet',
    hinweis: 'Bestand, Reichweite und der Verlauf über das Jahr.' },
  { key: 'plan', label: 'Zahlungsplan', href: '/liquiditaet/plan',
    hinweis: 'Der Plan Monat für Monat, im Konzernformat und nach Herkunft aufgegliedert.' },
  { key: 'szenarien', label: 'Szenarien', href: '/liquiditaet/szenarien',
    hinweis: 'Bandbreite und Sensitivität: was passiert, wenn Annahmen sich ändern.' },
  { key: 'herleitung', label: 'Herleitung', href: '/liquiditaet/herleitung',
    hinweis: 'Woher die Zahlungsziele kommen und wie jeder Monatswert entsteht.' },
];

export default async function LiquiditaetSeite(
  { searchParams, teil = 'ueberblick' }:
  { searchParams: Promise<Record<string, string>>; teil?: string }) {
  const benutzer = await requireRecht('liquidity.read');
  const sp = await searchParams;
  const jahr = Number(sp.jahr) || 2026;

  const g = await liqGrunddaten(jahr);
  if (!g.monate.length) {
    return (
      <Shell titel="Liquiditätsplanung" bereich={`Geschäftsjahr ${jahr}`} aktiv="liquiditaet" benutzer={benutzer}>
        <div className="note warn">
          <b>Für {jahr} sind keine Ausgangsdaten hinterlegt.</b> Das Modell braucht je Monat Umsatz,
          Bestandsänderung und EBITDA sowie mindestens zwei Ist-Bestände zur Kalibrierung.
          Die Daten liegen in <span className="mono">controlling.liq_monat</span> und
          <span className="mono"> controlling.liq_bestand</span>.
        </div>
      </Shell>
    );
  }

  const kal = kalibriere(g.monate, g.parameter, g.bestaende, g.finanzierung);
  const plan = rechne(g.monate, g.parameter, g.bestaende, g.finanzierung);
  const rw = reichweite(plan);
  const [bank, faellig, opKennzahlen, geplant, istZahl] = await Promise.all([
    bankMonatssummen(jahr), faelligkeiten(), offenePostenKennzahlen(),
    geplanteZahlungen(jahr), istZahlungen(jahr),
  ]);

  const planmonate = plan.filter(z => !z.ist);
  const alleMonate = plan.map(z => z.monat);
  const dsoV = versatz(g.parameter.dso_tage, g.parameter.tage_je_monat);
  const dpoV = versatz(g.parameter.dpo_tage, g.parameter.tage_je_monat);

  const szenarien = STANDARDSZENARIEN.map(s => {
    const opt = { ...s.opt };
    if (s.name === 'Konservativ') opt.dso = g.parameter.dso_tage + 15;
    if (s.name === 'Stress') opt.dso = g.parameter.dso_tage + 30;
    if (s.name === 'Chance') opt.dso = g.parameter.dso_tage - 20;
    const p = rechne(g.monate, g.parameter, g.bestaende, g.finanzierung, opt);
    return { ...s, zeilen: p.filter(z => !z.ist) };
  });

  /* Sensitivität: Jahresendbestand über Zahlungsziel und Anzahlungsquote */
  const dsoStufen = [-20, -10, 0, 10, 20, 30].map(d => g.parameter.dso_tage + d);
  const quoten = [0.6, 0.7, 0.8, 0.9, 1.0];
  const sens = dsoStufen.map(dso => ({
    dso,
    werte: quoten.map(q => {
      const p = rechne(g.monate, g.parameter, g.bestaende, g.finanzierung, { dso, realisierungsquote: q });
      return p[p.length - 1].bestand;
    }),
  }));

  const summe = (f: (z: typeof planmonate[number]) => number) => planmonate.reduce((a, z) => a + f(z), 0);

  return (
    <Shell titel="Liquiditätsplanung" bereich={`Geschäftsjahr ${jahr} · direkte Methode`}
           aktiv="liquiditaet" benutzer={benutzer}
           aktion={<Link className="btn primary" href={`/bericht?typ=liquiditaet&jahr=${jahr}`}>Bericht erzeugen</Link>}>

      <Unterseiten seiten={UNTERSEITEN} aktiv={teil} />
      {/* ---------------------------------------------------- Kennzahlen */}
      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Bestand Jahresende</div>
          <div className="value num">{eurKurz(rw?.bestandEnde)}</div>
          <div className="sub">nach {planmonate.length} Planmonaten</div>
        </div>
        <div className={`kpi ${(rw?.tiefpunkt.bestand ?? 0) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Tiefpunkt</div>
          <div className="value num">{eurKurz(rw?.tiefpunkt.bestand)}</div>
          <div className="sub">{monatName(rw?.tiefpunkt.monat)}</div>
        </div>
        <div className={`kpi ${(rw?.nettoBrennrate ?? 0) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Netto-Cashflow je Monat</div>
          <div className="value num">{eurKurz(rw?.nettoBrennrate)}</div>
          <div className="sub">Mittel über den Planzeitraum</div>
        </div>
        <div className="kpi">
          <div className="label">Geldmittelreichweite</div>
          <div className="value num">
            {rw?.reichweiteBrutto != null ? rw.reichweiteBrutto.toFixed(1) : '–'}
            <span style={{ fontSize: 15, fontWeight: 500 }}> Monate</span>
          </div>
          <div className="sub">Endbestand ÷ mittlere Auszahlung</div>
        </div>
        <div className={`kpi ${(rw?.finanzierungsbedarf ?? 0) > 0 ? 'bad' : 'good'}`}>
          <div className="label">Finanzierungsbedarf</div>
          <div className="value num">{eurKurz(rw?.finanzierungsbedarf)}</div>
          <div className="sub">
            {rw?.ersterNegativerMonat ? `ab ${monatName(rw.ersterNegativerMonat)}` : 'durchgehend zahlungsfähig'}
          </div>
        </div>
      </div>

      {teil === 'herleitung' && <>
      {/* ---------------------------------------------------- Kalibrierung */}
      {kal && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Grundlage</div>
              <h2>Woher die Zahlungsziele kommen</h2>
            </div>
            <span className={`chip ${kal.erklaerungsgrad >= 90 ? 'pos' : kal.erklaerungsgrad >= 75 ? 'warn' : 'neg'}`}>
              {pct(kal.erklaerungsgrad)} erklärt
            </span>
          </div>
          <div className="card-body flush">
            <div className="grid-2" style={{ gap: 0 }}>
              <div className="tablewrap">
                <table className="data compact">
                  <thead><tr><th>Parameter</th><th className="r">Wert</th><th>Bedeutung</th></tr></thead>
                  <tbody>
                    <tr>
                      <td><b>Debitorenlaufzeit</b></td>
                      <td className="r num">{kal.dso} Tage</td>
                      <td className="muted">
                        {pct(dsoV.gewichtNah * 100)} fließen nach {dsoV.f} Monaten zu,
                        {' '}{pct(dsoV.gewichtFern * 100)} einen Monat später
                      </td>
                    </tr>
                    <tr>
                      <td><b>Kreditorenlaufzeit</b></td>
                      <td className="r num">{kal.dpo} Tage</td>
                      <td className="muted">
                        {pct(dpoV.gewichtNah * 100)} werden nach {dpoV.f} Monat gezahlt,
                        {' '}{pct(dpoV.gewichtFern * 100)} einen Monat später
                      </td>
                    </tr>
                    <tr>
                      <td><b>Systematischer Zufluss</b></td>
                      <td className="r num">{eur0(kal.systematischerZufluss)}</td>
                      <td className="muted">je Monat, weder Umsatz noch Anzahlung zuzuordnen</td>
                    </tr>
                    <tr className="total">
                      <td>Erklärungsgrad</td>
                      <td className="r num">{pct(kal.erklaerungsgrad)}</td>
                      <td className="muted">
                        mittlere Abweichung {eur0(kal.mittlereAbweichung)} bei
                        {' '}{eur0(kal.mittlereIstBewegung)} mittlerer Monatsbewegung
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="tablewrap">
                <table className="data compact">
                  <thead><tr><th>Stützstelle</th><th className="r">Modell</th><th className="r">Ist</th><th className="r">Abweichung</th></tr></thead>
                  <tbody>
                    {kal.stuetzstellen.map(s => (
                      <tr key={s.monat}>
                        <td>{monatName(s.monat)}</td>
                        <td className={`r num ${vz(s.modell)}`}>{eur0(s.modell)}</td>
                        <td className={`r num ${vz(s.ist)}`}>{eur0(s.ist)}</td>
                        <td className="r num muted">{eur0(s.abweichung)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>
                {kal.stuetzstellen.length} Stützstellen bei drei Parametern sind wenig. Die Werte sind
                belastbar für die Größenordnung, nicht auf den Tag genau. Jeder weitere Ist-Bestand
                verbessert die Kalibrierung spürbar – dafür genügen die Kontoauszüge zum Monatsende.
              </span>
            </div>
          </div>
        </div>
      )}

      </>}

      {teil === 'ueberblick' && <>
      {/* ---------------------------------------------------- Verlauf */}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Verlauf</div><h2>Liquiditätsbestand je Monatsende</h2></div>
        </div>
        <div className="legend">
          <span><i style={{ background: '#2563eb' }} />Bestand laut Modell</span>
          <span><i style={{ background: '#0d9488' }} />Ist-Bestand</span>
        </div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          <LinienChart monate={alleMonate} hoehe={250} serien={[
            { label: 'Bestand', farbe: '#2563eb', werte: plan.map(z => z.bestand) },
            { label: 'Ist-Bestand', farbe: '#0d9488', werte: plan.map(z => z.bestand_ist ?? 0) },
          ]} />
        </div>
      </div>

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Zahlungsströme</div><h2>Ein- und Auszahlungen je Monat</h2></div>
          </div>
          <div className="legend">
            <span><i style={{ background: '#2563eb' }} />Zahlungseingang Umsatz</span>
            <span><i style={{ background: '#0d9488' }} />Anzahlungen</span>
            <span><i style={{ background: '#e11d48' }} />Auszahlungen</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <SaeulenChart monate={planmonate.map(z => z.monat)} hoehe={240} serien={[
              { label: 'Umsatzeingang', farbe: '#2563eb', werte: planmonate.map(z => z.eingang_umsatz) },
              { label: 'Anzahlungen', farbe: '#0d9488', werte: planmonate.map(z => z.zugang_az) },
              { label: 'Auszahlungen', farbe: '#e11d48', werte: planmonate.map(z => z.auszahlungen) },
            ]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Herkunft</div>
              <h2>Woraus der Endbestand entsteht</h2>
            </div>
          </div>
          <div className="card-body">
            <WasserfallChart hoehe={280} schritte={[
              { label: 'Start', wert: num(g.parameter.startbestand), typ: 'start' },
              { label: 'Umsatz', wert: -summe(z => z.eingang_umsatz), typ: 'ab' },
              { label: 'Anzahlung', wert: -summe(z => z.zugang_az), typ: 'ab' },
              { label: 'syst. Zufluss', wert: -summe(z => z.systematischer_zufluss), typ: 'ab' },
              { label: 'Auszahlung', wert: -summe(z => z.auszahlungen), typ: 'ab' },
              { label: 'Finanzierung', wert: -summe(z => z.finanzierung), typ: 'ab' },
              { label: 'Endbestand', wert: rw?.bestandEnde ?? 0, typ: 'ergebnis' },
            ]} />
          </div>
        </div>
      </div>

      </>}

      {teil === 'plan' && <>
      {/* ---------------------------------------------------- Gruppenstruktur */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Konzernformat</div>
            <h2>Startsaldo, Ausgänge, Eingänge, Endsaldo</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead>
                <tr>
                  <th>Position</th>
                  {planmonate.map(z => <th key={z.monat} className="r">{monatKurz(z.monat)}</th>)}
                  <th className="r fix-r">Summe</th>
                </tr>
              </thead>
              <tbody>
                <tr className="step">
                  <td>Startsaldo</td>
                  {planmonate.map((z, i) => (
                    <td key={z.monat} className="r num">
                      {eur0(i === 0 ? num(g.parameter.startbestand) : planmonate[i - 1].bestand)}
                    </td>
                  ))}
                  <td className="r num fix-r">{eur0(g.parameter.startbestand)}</td>
                </tr>

                <tr className="head-row"><td colSpan={planmonate.length + 2}>Ausgänge</td></tr>
                {([
                  ['Lieferanten und Fremdleistungen', (z: any) => z.auszahlung_sachkosten],
                  ['Personal', (z: any) => z.personal],
                  ['Steuern und Zinsen', (z: any) => z.zins_steuer],
                  ['Umsatzsteuer-Zahllast', (z: any) => z.umsatzsteuer],
                  ['Investitionen', (z: any) => z.investition],
                ] as const).filter(([, f]) => planmonate.some(z => f(z) !== 0)).map(([bez, f]) => (
                  <tr key={bez}>
                    <td className="indent">{bez}</td>
                    {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                    <td className="r num fix-r">{eur0(summe(f))}</td>
                  </tr>
                ))}
                <tr className="sub">
                  <td>Σ Ausgänge</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.auszahlungen)}</td>)}
                  <td className="r num fix-r"><b>{eur0(summe(z => z.auszahlungen))}</b></td>
                </tr>

                <tr className="head-row"><td colSpan={planmonate.length + 2}>Eingänge</td></tr>
                {([
                  ['Kundenzahlungen', (z: any) => z.eingang_umsatz],
                  ['Anzahlungen', (z: any) => z.zugang_az],
                  ['Systematischer Zufluss', (z: any) => z.systematischer_zufluss],
                  ['Finanzierung', (z: any) => z.finanzierung],
                ] as const).filter(([, f]) => planmonate.some(z => f(z) !== 0)).map(([bez, f]) => (
                  <tr key={bez}>
                    <td className="indent">{bez}</td>
                    {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                    <td className="r num fix-r">{eur0(summe(f))}</td>
                  </tr>
                ))}
                <tr className="sub">
                  <td>Σ Eingänge</td>
                  {planmonate.map(z => (
                    <td key={z.monat} className="r num">{eur0(z.einzahlungen + z.finanzierung)}</td>
                  ))}
                  <td className="r num fix-r">
                    <b>{eur0(summe(z => z.einzahlungen + z.finanzierung))}</b>
                  </td>
                </tr>

                <tr className="result">
                  <td>Endsaldo</td>
                  {planmonate.map(z => (
                    <td key={z.monat} className="r num">
                      {eur0(z.bestand)}
                      {rw && z.monat === rw.tiefpunkt.monat && (
                        <div style={{ fontSize: 10, opacity: .75 }}>Tiefpunkt</div>
                      )}
                    </td>
                  ))}
                  <td className="r num fix-r"><b>{eur0(planmonate[planmonate.length - 1]?.bestand)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- Plan */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Liquiditätsplan</div>
            <h2>Direkte Methode, {monatName(planmonate[0]?.monat)} bis {monatName(planmonate[planmonate.length - 1]?.monat)}</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead>
                <tr>
                  <th>Position</th>
                  {planmonate.map(z => <th key={z.monat} className="r">{monatKurz(z.monat)}</th>)}
                  <th className="r fix-r">Summe</th>
                </tr>
              </thead>
              <tbody>
                <tr className="head-row"><td colSpan={planmonate.length + 2}>Einzahlungen</td></tr>
                {([
                  ['Zahlungseingang aus Umsatz', (z: any) => z.eingang_umsatz, `${g.parameter.dso_tage} Tage nach Umsatzbuchung`],
                  ['Zugang erhaltene Anzahlungen', (z: any) => z.zugang_az, 'nur ein Anstieg des Bestands ist ein Zufluss'],
                  ['Systematischer Zufluss', (z: any) => z.systematischer_zufluss, 'aus der Kalibrierung, sachlich nicht zugeordnet'],
                ] as const).map(([bez, f, hinweis]) => (
                  <tr key={bez}>
                    <td className="indent">{bez}<span className="formula">{hinweis}</span></td>
                    {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                    <td className="r num fix-r">{eur0(summe(f))}</td>
                  </tr>
                ))}
                <tr className="step">
                  <td>= Summe Einzahlungen</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.einzahlungen)}</td>)}
                  <td className="r num fix-r"><b>{eur0(summe(z => z.einzahlungen))}</b></td>
                </tr>

                <tr className="head-row"><td colSpan={planmonate.length + 2}>Auszahlungen</td></tr>
                {([
                  ['Personal', (z: any) => z.personal, 'kein Zahlungsziel, Zahlung im Entstehungsmonat'],
                  ['Sachkosten und Fremdleistungen', (z: any) => z.auszahlung_sachkosten, `${g.parameter.dpo_tage} Tage nach Kostenentstehung`],
                  ['Zinsen und sonstige Steuern', (z: any) => z.zins_steuer, 'Monatsansatz'],
                  ['Investitionen', (z: any) => z.investition, 'Annahme: keine im Planzeitraum'],
                ] as const).map(([bez, f, hinweis]) => (
                  <tr key={bez}>
                    <td className="indent">{bez}<span className="formula">{hinweis}</span></td>
                    {planmonate.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                    <td className="r num fix-r">{eur0(summe(f))}</td>
                  </tr>
                ))}
                <tr className="step">
                  <td>= Summe Auszahlungen</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.auszahlungen)}</td>)}
                  <td className="r num fix-r"><b>{eur0(summe(z => z.auszahlungen))}</b></td>
                </tr>

                <tr className="step">
                  <td>= Operativer Cashflow</td>
                  {planmonate.map(z => (
                    <td key={z.monat} className={`r num ${vz(z.operativer_cashflow)}`}>{eur0(z.operativer_cashflow)}</td>
                  ))}
                  <td className="r num fix-r"><b>{eur0(summe(z => z.operativer_cashflow))}</b></td>
                </tr>

                {planmonate.some(z => z.finanzierung !== 0) && (
                  <tr>
                    <td className="indent">Finanzierung
                      <span className="formula">
                        {[...new Set(planmonate.flatMap(z => z.finanzierung_posten.map(f => f.beschreibung)))].join(' · ')}
                      </span>
                    </td>
                    {planmonate.map(z => <td key={z.monat} className="r num">{z.finanzierung ? eur0(z.finanzierung) : '–'}</td>)}
                    <td className="r num fix-r">{eur0(summe(z => z.finanzierung))}</td>
                  </tr>
                )}

                <tr className="step">
                  <td>= Veränderung</td>
                  {planmonate.map(z => <td key={z.monat} className={`r num ${vz(z.veraenderung)}`}>{eur0(z.veraenderung)}</td>)}
                  <td className="r num fix-r"><b>{eur0(summe(z => z.veraenderung))}</b></td>
                </tr>
                <tr className="result">
                  <td>Liquidität Monatsende</td>
                  {planmonate.map(z => <td key={z.monat} className="r num">{eur0(z.bestand)}</td>)}
                  <td className="r num fix-r"><b>{eur0(planmonate[planmonate.length - 1]?.bestand)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </>}

      {teil === 'szenarien' && <>
      {/* ---------------------------------------------------- Szenarien */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Bandbreite</div>
            <h2>Szenarien</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Szenario</th>
                  {planmonate.map(z => <th key={z.monat} className="r">{monatKurz(z.monat)}</th>)}
                  <th className="r fix-r">Jahresende</th>
                </tr>
              </thead>
              <tbody>
                {szenarien.map(s => {
                  const ende = s.zeilen[s.zeilen.length - 1]?.bestand ?? 0;
                  return (
                    <tr key={s.name}>
                      <td><b>{s.name}</b><span className="formula">{s.beschreibung}</span></td>
                      {s.zeilen.map(z => (
                        <td key={z.monat} className={`r num ${z.bestand < 0 ? 'neg' : ''}`}>{eur0(z.bestand)}</td>
                      ))}
                      <td className={`r num fix-r ${vz(ende)}`}><b>{eur0(ende)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Sensitivität</div>
            <h2>Jahresendbestand nach Zahlungsziel und Anzahlungsquote</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Debitorenlaufzeit</th>{quoten.map(q => <th key={q} className="r">{pct(q * 100, 0)}</th>)}</tr>
              </thead>
              <tbody>
                {sens.map(r => (
                  <tr key={r.dso} style={r.dso === g.parameter.dso_tage ? { background: 'var(--accent-soft)' } : undefined}>
                    <td><b>{r.dso} Tage</b>{r.dso === g.parameter.dso_tage && <span className="chip info" style={{ marginLeft: 6 }}>kalibriert</span>}</td>
                    {r.werte.map((w, i) => <td key={i} className={`r num ${w < 0 ? 'neg' : ''}`}>{eur0(w)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              Spannweite über die Anzahlungsquote: {eurKurz(Math.max(...sens.flatMap(r => r.werte)) - Math.min(...sens.flatMap(r => r.werte)))}.
              Der Terminplan der Anzahlungsanforderungen ist damit der wirksamere Steuerungshebel
              als die Debitorenlaufzeit.
            </span>
          </div>
        </div>
      </div>

      </>}

      {teil === 'herleitung' && <>
      {/* ---------------------------------------------------- Herleitung */}
      <div className="card" id="herleitung">
        <div className="card-head">
          <div>
            <div className="eyebrow">Nachvollziehbarkeit</div>
            <h2>Herleitung je Monat</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Position</th>
                  {alleMonate.map(m => <th key={m} className="r">{monatKurz(m)}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="head-row"><td colSpan={alleMonate.length + 1}>Schritt 1 · zahlungswirksame Sachkosten</td></tr>
                {([
                  ['Umsatz', (z: any) => z.umsatz],
                  ['Bestandsänderung', (z: any) => z.bestandsaenderung],
                  ['= Gesamtleistung', (z: any) => z.gesamtleistung],
                  ['− EBITDA', (z: any) => z.ebitda],
                  ['= Gesamtkosten', (z: any) => z.gesamtkosten],
                  ['= zahlungswirksame Sachkosten', (z: any) => z.sachkosten],
                ] as const).map(([bez, f]) => (
                  <tr key={bez} className={bez.startsWith('=') ? 'sub' : ''}>
                    <td>{bez}</td>
                    {plan.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                  </tr>
                ))}
                <tr className="head-row"><td colSpan={alleMonate.length + 1}>Schritt 2 · Anzahlungsbewegung</td></tr>
                {([
                  ['Δ erhaltene Anzahlungen', (z: any) => z.delta_erhaltene_az],
                  ['davon Neuzugang (Zufluss)', (z: any) => z.neuzugang_az],
                  ['davon Verrechnung (zahlungsneutral)', (z: any) => z.verrechnung_az],
                  ['= Umsatz abzüglich Verrechnung', (z: any) => z.umsatz_netto],
                ] as const).map(([bez, f]) => (
                  <tr key={bez} className={bez.startsWith('=') ? 'sub' : ''}>
                    <td>{bez}</td>
                    {plan.map(z => <td key={z.monat} className="r num">{eur0(f(z))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- Ist-Zahlungen */}
      {!!istZahl.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Tatsächlich geflossen</div>
              <h2>Zahlungen der Bank- und Cash-Pool-Konten</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Monat</th><th className="r">Eingang</th><th className="r">Ausgang</th>
                      <th className="r">Saldo</th><th className="r">Bewegungen</th>
                      <th className="r">Modellveränderung</th></tr>
                </thead>
                <tbody>
                  {istZahl.map(z => {
                    const modell = plan.find(p => p.monat === z.monat);
                    return (
                      <tr key={z.monat}>
                        <td><b>{monatName(z.monat)}</b></td>
                        <td className="r num pos">{eur0(z.eingang)}</td>
                        <td className="r num neg">{eur0(-num(z.ausgang))}</td>
                        <td className={`r num ${vz(z.saldo)}`}><b>{eur0(z.saldo)}</b></td>
                        <td className="r num muted">{zahl(z.bewegungen)}</td>
                        <td className="r num muted">
                          {modell?.veraenderung_ist != null ? eur0(modell.veraenderung_ist) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="total">
                    <td>Summe</td>
                    <td className="r num">{eur0(istZahl.reduce((a, z) => a + num(z.eingang), 0))}</td>
                    <td className="r num">{eur0(-istZahl.reduce((a, z) => a + num(z.ausgang), 0))}</td>
                    <td className="r num">{eur0(istZahl.reduce((a, z) => a + num(z.saldo), 0))}</td>
                    <td className="r num">{zahl(istZahl.reduce((a, z) => a + num(z.bewegungen), 0))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- Geplante Zahlungen */}
      {!!geplant.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Aus der Planung</div>
              <h2>Geplante Zahlungen der Regionen</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Monat</th><th className="r">Einzahlungen</th><th className="r">Auszahlungen</th>
                      <th className="r">Saldo</th><th className="r">Einträge</th></tr>
                </thead>
                <tbody>
                  {geplant.map(z => (
                    <tr key={z.monat}>
                      <td><b>{monatName(z.monat)}</b></td>
                      <td className="r num pos">{eur0(z.einzahlungen)}</td>
                      <td className="r num neg">{eur0(z.auszahlungen)}</td>
                      <td className={`r num ${vz(z.saldo)}`}><b>{eur0(z.saldo)}</b></td>
                      <td className="r num muted">{zahl(z.anzahl)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Summe</td>
                    <td className="r num">{eur0(geplant.reduce((a, z) => a + num(z.einzahlungen), 0))}</td>
                    <td className="r num">{eur0(geplant.reduce((a, z) => a + num(z.auszahlungen), 0))}</td>
                    <td className="r num">{eur0(geplant.reduce((a, z) => a + num(z.saldo), 0))}</td>
                    <td className="r num">{zahl(geplant.reduce((a, z) => a + num(z.anzahl), 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- Fälligkeiten */}
      {!!faellig.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Offene Posten</div>
              <h2>Fälligkeitsstruktur</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {opKennzahlen.map(k => (
                <span key={k.art} className={`chip ${num(k.ueberfaellig) ? 'warn' : ''}`}>
                  {k.art === 'FORDERUNG' ? 'Forderungen' : 'Verbindlichkeiten'} {eurKurz(k.summe)}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Fälligkeitsmonat</th><th className="r">Forderungen</th>
                      <th className="r">Verbindlichkeiten</th><th className="r">Saldo</th>
                      <th className="r">Posten</th><th /></tr>
                </thead>
                <tbody>
                  {faellig.map(f => (
                    <tr key={f.monat}>
                      <td><b>{f.monat}</b>
                        {f.ueberfaellig && <span className="chip warn" style={{ marginLeft: 8 }}>überfällig</span>}</td>
                      <td className="r num">{num(f.forderungen) ? eur0(f.forderungen) : '–'}</td>
                      <td className="r num">{num(f.verbindlichkeiten) ? eur0(f.verbindlichkeiten) : '–'}</td>
                      <td className={`r num ${vz(f.saldo)}`}><b>{eur0(f.saldo)}</b></td>
                      <td className="r num muted">{zahl(f.anzahl)}</td>
                      <td />
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Summe</td>
                    <td className="r num">{eur0(faellig.reduce((a, f) => a + num(f.forderungen), 0))}</td>
                    <td className="r num">{eur0(faellig.reduce((a, f) => a + num(f.verbindlichkeiten), 0))}</td>
                    <td className="r num">{eur0(faellig.reduce((a, f) => a + num(f.saldo), 0))}</td>
                    <td className="r num">{zahl(faellig.reduce((a, f) => a + num(f.anzahl), 0))}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- Kontoauszüge */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Ist-Zahlungen</div>
            <h2>Kontoauszüge</h2>
          </div>
          <Link className="btn" href="/import">Kontoauszug importieren</Link>
        </div>
        <div className="card-body">
          {bank.length === 0 ? (
            <div className="note warn" style={{ marginBottom: 0 }}>
              <p><b>Noch keine Bankbewegungen importiert.</b> Solange sie fehlen, stützt sich die
                 Kalibrierung auf {kal?.stuetzstellen.length ?? 0} Monatsbestände, und der systematische
                 Zufluss von {eur0(kal?.systematischerZufluss ?? 0)} je Monat bleibt sachlich nicht zugeordnet.</p>
              <p>Mit den Auszügen wird daraus: echte Ist-Bestände zu jedem Monatsende, eine Zuordnung
                 des systematischen Zuflusses über die Gegenkonten, und tatsächliche statt hergeleitete
                 Zahlungsziele je Debitor und Kreditor.</p>
            </div>
          ) : (
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Monat</th><th>Kategorie</th><th className="r">Betrag</th><th className="r">Bewegungen</th></tr></thead>
                <tbody>
                  {bank.map((b, i) => (
                    <tr key={i}>
                      <td>{monatName(b.monat)}</td>
                      <td className="muted">{b.kategorie}</td>
                      <td className={`r num ${vz(b.betrag)}`}>{eur0(b.betrag)}</td>
                      <td className="r num muted">{zahl(b.anzahl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </>}
    </Shell>
  );
}