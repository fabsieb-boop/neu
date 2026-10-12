import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../../components/Shell';
import Unterseiten from '../../../components/Unterseiten';
import PeriodenWahl from '../../../components/PeriodenWahl';
import { SaeulenChart, RangChart } from '../../../components/Charts';
import { requireRecht } from '@/lib/guard';
import { zeitraum } from '@/lib/zeitraum';
import {
  geschaeftsjahre, letzterBelastbarerMonat, projektErgebnis, projektKostenarten,
  projektMonate, kvDeckblattJeAuftrag, bestandDeckungAlle, stundenProjekte,
} from '@/lib/queries';
import { eur0, eurKurz, pct, zahl, datum, num } from '@/lib/format';
import { projektSeiten } from '../seiten';

export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------------
   Einzelauswertung eines Auftrags
   ---------------------------------------------------------------------------
   Die Übersicht daneben zeigt den Auftrag – wer ihn führt, was kalkuliert
   wurde, welche Risiken bekannt sind.  Diese Seite stellt nur eine Frage:
   trägt er, und woran liegt es?

   Deshalb steht hier zweierlei nebeneinander, was sonst an zwei Stellen
   liegt: die Buchungen aus SAP und das Übersichtsblatt, das die
   Projektleitung selbst führt.  Gehen die beiden auseinander, ist das der
   erste Befund – noch bevor irgendeine Marge gerechnet wird.
--------------------------------------------------------------------------- */

const BEFUND: Record<string, { label: string; farbe: string; ton: string }> = {
  OK:                   { label: 'Gedeckt',              farbe: '#047857', ton: 'good' },
  LANGE_OHNE_RECHNUNG:  { label: 'Lange ohne Rechnung',  farbe: '#b45309', ton: '' },
  VORAUSBERECHNET:      { label: 'Vorausberechnet',      farbe: '#2563eb', ton: '' },
  UEBERAKTIVIERT:       { label: 'Überaktiviert',        farbe: '#be123c', ton: 'bad' },
  OHNE_BESTANDSBUCHUNG: { label: 'Ohne Bestandsbuchung', farbe: '#7c3aed', ton: 'bad' },
};

/* Die Blöcke des Übersichtsblatts in der Reihenfolge, in der sie dort
   stehen.  Kosten werden zum Vergleich positiv gezeigt – die
   Kostenverfolgung führt sie so, und ein Vorzeichenwechsel mitten in der
   Gegenüberstellung hilft niemandem. */
const KV_BLOECKE: { label: string; kalk: string; ist: string }[] = [
  { label: 'Umsatz',            kalk: 'gesamtumsatz_kalk', ist: 'gesamtumsatz_ist' },
  { label: 'Personalkosten',    kalk: 'personal_kalk',     ist: 'personal_ist' },
  { label: 'Gerätekosten',      kalk: 'geraete_kalk',      ist: 'geraete_ist' },
  { label: 'Fremdleistungen',   kalk: 'fremd_kalk',        ist: 'fremd_ist' },
  { label: 'Sonstige Kosten',   kalk: 'sonstige_kalk',     ist: 'sonstige_ist' },
  { label: 'Schrottvergütung',  kalk: 'schrott_kalk',      ist: 'schrott_ist' },
  { label: 'Summe Kosten',      kalk: 'gesamtkosten_kalk', ist: 'gesamtkosten_ist' },
];

export default async function ProjektAuswertung({
  params, searchParams,
}: { params: Promise<{ nr: string }>; searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('projects.read');
  const { nr } = await params;
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));

  const projekt = await projektErgebnis(jahr, nr, z.von, z.bis);
  if (!projekt) notFound();

  const [kostenarten, monate, kv, bestandAlle, stundenAlle] = await Promise.all([
    projektKostenarten(jahr, nr, z.von, z.bis).catch(() => []),
    projektMonate(jahr, nr, z.von, z.bis).catch(() => []),
    kvDeckblattJeAuftrag(nr).catch(() => null),
    bestandDeckungAlle().catch(() => []),
    stundenProjekte(jahr, z.von, z.bis).catch(() => []),
  ]);

  const bestand = bestandAlle.find(b => b.auftrag === nr) ?? null;
  const stunden = stundenAlle.filter(s => s.projekt_nr === nr)
                             .reduce((a, s) => a + num(s.stunden), 0);

  const leistung = num(projekt.leistung);
  const db3 = num(projekt.db3);
  const marge = leistung > 0 ? (db3 / leistung) * 100 : null;
  const kosten = num(projekt.variable_kosten) + num(projekt.fixe_projektkosten)
               + num(projekt.verrechnete_gk);

  const b = bestand ? BEFUND[bestand.befund] : null;
  const kvErgebnis = kv ? num(kv.ergebnis_ist) : null;
  const kvKalk = kv ? num(kv.ergebnis_kalk) : null;

  /* Die Staffel: was von der Leistung übrig bleibt, Stufe für Stufe. */
  const staffel = [
    { label: 'Betriebsleistung',       wert: leistung },
    { label: 'Variable Einzelkosten',  wert: -num(projekt.variable_kosten) },
    { label: 'Deckungsbeitrag I',      wert: num(projekt.db1), stufe: true },
    { label: 'Fixe Projektkosten',     wert: -num(projekt.fixe_projektkosten) },
    { label: 'Deckungsbeitrag II',     wert: num(projekt.db2), stufe: true },
    { label: 'Verrechnete Gemeinkosten', wert: -num(projekt.verrechnete_gk) },
    { label: 'Deckungsbeitrag III',    wert: db3, stufe: true, ergebnis: true },
  ];

  const groesste = kostenarten
    .filter(k => num(k.wert) < 0)
    .sort((a, c) => num(a.wert) - num(c.wert))
    .slice(0, 12)
    .map(k => ({ label: k.kostenart_bez || k.kostenart_nr, wert: -num(k.wert),
                 hinweis: `${zahl(k.belege)} Belege` }));

  return (
    <Shell titel={projekt.projektname || projekt.projekt_nr}
           bereich={`${projekt.projekt_nr} · Region ${projekt.region} · ${z.text} ${jahr}`}
           aktiv="projekte" benutzer={benutzer}
           aktion={<Link className="btn" href={`/projekte/auswertung?jahr=${jahr}`}>
                     Alle Aufträge
                   </Link>}>
      <Unterseiten seiten={projektSeiten(nr)} aktiv="auswertung" />

      <div className="card">
        <PeriodenWahl pfad={`/projekte/${encodeURIComponent(nr)}/auswertung`}
                      jahre={jahre} jahr={jahr} zeitraum={z} />
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Betriebsleistung</div>
          <div className="value num">{eurKurz(leistung)}</div>
          <div className="sub">{zahl(projekt.belege)} Belege</div>
        </div>
        <div className={`kpi ${db3 >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Deckungsbeitrag III</div>
          <div className="value num">{eurKurz(db3)}</div>
          <div className="sub">{marge === null ? '–' : pct(marge)}</div>
        </div>
        <div className={`kpi ${kvErgebnis === null ? '' : kvErgebnis >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Ergebnis lt. Kostenverfolgung</div>
          <div className="value num">
            {kvErgebnis === null ? '–' : eurKurz(kvErgebnis)}
          </div>
          <div className="sub">
            {kv
              ? <>kalkuliert {kvKalk ? eurKurz(kvKalk) : '–'}
                  <span className="zeile">{kv.stand ? datum(kv.stand) : ''}</span></>
              : '–'}
          </div>
        </div>
        <div className={`kpi ${b ? b.ton : ''}`}>
          <div className="label">Bestandsdeckung</div>
          <div className="value num" style={b ? { color: b.farbe } : undefined}>
            {b ? b.label : '–'}
          </div>
          <div className="sub">
            {bestand
              ? <>{num(bestand.ungedeckt) > 0
                    ? `${eur0(bestand.ungedeckt)} nicht gedeckt`
                    : `${eur0(bestand.ueberdeckt)} überdeckt`}
                  <span className="zeile">
                    {bestand.letzte_rechnung ? datum(bestand.letzte_rechnung) : '–'}
                  </span></>
              : '–'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">{z.text} {jahr}</div>
               <h2>Leistung und Ergebnis je Monat</h2></div>
        </div>
        <div className="card-body">
          <SaeulenChart
            monate={monate.map(m => Number(m.monat))}
            serien={[
              { label: 'Betriebsleistung', farbe: '#1e3a8a',
                werte: monate.map(m => num(m.leistung)) },
              { label: 'Kosten', farbe: '#b45309',
                werte: monate.map(m => -(num(m.k_var) + num(m.k_fix) + num(m.umlage))) },
              { label: 'Deckungsbeitrag III', farbe: '#047857',
                werte: monate.map(m => num(m.db3)) },
            ]} />
        </div>
      </div>

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Übersichtsblatt der Projektleitung</div>
                 <h2>Kalkuliert gegen aktuell</h2></div>
            {kv?.erfuellung != null && (
              <span className="chip info">Erfüllung {pct(num(kv.erfuellung) * 100)}</span>
            )}
          </div>
          <div className="card-body flush">
            {kv ? (
              <div className="tablewrap">
                <table className="data compact">
                  <thead>
                    <tr><th>Position</th><th className="r">kalkuliert</th>
                        <th className="r">aktuell</th><th className="r">Differenz</th></tr>
                  </thead>
                  <tbody>
                    {KV_BLOECKE.map(zeile => {
                      const rec = kv as unknown as Record<string, number | null>;
                      const k = rec[zeile.kalk], i = rec[zeile.ist];
                      if (k == null && i == null) return null;
                      /* Eine Differenz gibt es nur, wenn beide Seiten da sind.
                         Sonst stand dort der volle Ist-Wert, und das las sich,
                         als sei alles neu hinzugekommen. */
                      const d = k == null || i == null ? null : num(i) - num(k);
                      const kosten = zeile.label !== 'Umsatz';
                      const ton = d === null ? '' : kosten
                        ? (d > 0 ? 'neg' : 'pos') : (d < 0 ? 'neg' : 'pos');
                      return (
                        <tr key={zeile.label}
                            className={zeile.label.startsWith('Summe') ? 'step' : ''}>
                          <td>{zeile.label}</td>
                          <td className="r num">{k == null ? '–' : eur0(k)}</td>
                          <td className="r num">{i == null ? '–' : eur0(i)}</td>
                          <td className={`r num ${ton}`}>
                            <b>{d === null ? '–' : eur0(d)}</b>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="result">
                      <td><b>Ergebnis</b></td>
                      <td className="r num">{kvKalk == null ? '–' : eur0(kvKalk)}</td>
                      <td className="r num">{kvErgebnis == null ? '–' : eur0(kvErgebnis)}</td>
                      <td className={`r num ${kvErgebnis == null || kvKalk == null ? ''
                                    : kvErgebnis - kvKalk < 0 ? 'neg' : 'pos'}`}>
                        <b>{kvErgebnis == null || kvKalk == null
                              ? '–' : eur0(kvErgebnis - kvKalk)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                Keine Kostenverfolgung eingelesen.{' '}
                    <Link href="/import/kostenverfolgung"
                      style={{ color: 'var(--accent)' }}>Import</Link>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Aus den Buchungen</div>
                 <h2>Deckungsbeitragsstaffel</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data staffel">
                <tbody>
                  {staffel.map(s => (
                    <tr key={s.label}
                        className={s.ergebnis ? 'result' : s.stufe ? 'step' : ''}>
                      <td>{s.label}</td>
                      <td className="r num">{eur0(s.wert)}</td>
                      <td className="r num muted">
                        {leistung > 0 ? pct((s.wert / leistung) * 100) : '–'}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="muted">Gebuchte Stunden</td>
                    <td className="r num muted">{zahl(stunden)}</td>
                    <td className="r num muted">
                      {stunden > 0 ? `${eur0(kosten / stunden)}/h` : '–'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Woran es liegt</div>
               <h2>Größte Kostenarten</h2></div>
          <span className="chip info">{zahl(kostenarten.length)} Kostenarten</span>
        </div>
        <div className="card-body">
          <RangChart zeilen={groesste} zweifarbig={false} />
        </div>
      </div>
    </Shell>
  );
}
