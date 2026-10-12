import Link from 'next/link';
import Shell from '../components/Shell';
import PeriodenWahl from '../components/PeriodenWahl';
import { requireRecht } from '@/lib/guard';
import { geschaeftsjahre, perioden, bestandOhneRechnung, bestandGrenzen,
         bestandDeckung } from '@/lib/queries';
import { allesPruefen } from '@/lib/pruefung';
import { eur, eur0, pct, zahl, num } from '@/lib/format';
import { RangChart } from '../components/Charts';

/**
 * Die vier Befunde der Bestandsdeckung, in der Reihenfolge, in der sie
 * wehtun.  Der Text sagt, was zu tun ist – nicht, was die Datenbank
 * gerechnet hat.
 */
const BEFUNDE = [
  { key: 'OHNE_BESTANDSBUCHUNG', titel: 'Kosten ohne Rechnung und ohne Bestandsbuchung',
    ton: 'neg',
    was: 'Das Projekt trägt Kosten, die weder berechnet noch aktiviert sind. Es zeigt einen '
       + 'Verlust, den es so wahrscheinlich nicht hat – es fehlt die Bestandsveränderung.' },
  { key: 'UEBERAKTIVIERT', titel: 'Mehr aktiviert als gekostet',
    ton: 'neg',
    was: 'Die Bestandsveränderung liegt über den angefallenen Kosten. Damit steckt Ergebnis '
       + 'im Bestand, das noch nicht verdient ist. Bei Bewertung zum Verkaufspreis kann das '
       + 'gewollt sein – dann gehört der Ansatz dokumentiert.' },
  { key: 'VORAUSBERECHNET', titel: 'Mehr berechnet als gekostet, ohne Bestandsabbau',
    ton: 'warn',
    was: 'Es wurde mehr in Rechnung gestellt, als das Projekt bisher gekostet hat, ohne '
       + 'dass Bestand abgebaut wurde. Bei Anzahlungsrechnungen ist das normal – dann fehlt '
       + 'die Abgrenzung. Sonst ist das Ergebnis vorweggenommen.' },
  { key: 'LANGE_OHNE_RECHNUNG', titel: 'Lange keine Rechnung',
    ton: 'warn',
    was: 'Nicht abgerechnete Leistung, deren letzte Rechnung länger als die Frist zurückliegt.' },
] as const;

export const dynamic = 'force-dynamic';

export default async function PruefungSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('system.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const monate = await perioden(jahr);
  const periode = Number(sp.monat) || Math.max(...monate, 1);

  const [ergebnisse, bestand, grenzen, deckung] = await Promise.all([
    allesPruefen(jahr, periode),
    bestandOhneRechnung().catch(() => []),
    bestandGrenzen().catch(() => ({ tage: 35, bagatelle: 1000, luecke: 25000 })),
    bestandDeckung().catch(() => []),
  ]);
  const bestandOffen = bestand.filter(b => b.auffaellig);
  const gefallen = ergebnisse.filter(e => !e.bestanden);
  const gruppen = [...new Set(ergebnisse.map(e => e.gruppe))];

  const wert = (e: typeof ergebnisse[number], v: number | null) => {
    if (v === null) return '–';
    return e.einheit === 'Anzahl' ? zahl(v) : eur(v);
  };

  return (
    <Shell titel="Selbstprüfung" bereich={`Geschäftsjahr ${jahr} · bis Periode ${periode}`}
           aktiv="pruefung" benutzer={benutzer}
           aktion={
             <span className={`chip ${gefallen.length ? 'neg' : 'pos'}`}>
               {gefallen.length
                 ? `${gefallen.length} von ${ergebnisse.length} nicht bestanden`
                 : `Alle ${ergebnisse.length} Prüfungen bestanden`}
             </span>
           }>

      <div className="card">
        <PeriodenWahl pfad="/pruefung" jahre={jahre} jahr={jahr} monate={monate} monat={periode}
                      alleMonateLabel="letzte belastbare Periode" />
      </div>

      <div className={`note ${gefallen.length ? 'warn' : ''}`}>
        {gefallen.length ? (
          <>
            <b>{gefallen.length} Prüfung{gefallen.length > 1 ? 'en schlagen' : ' schlägt'} an.</b>{' '}
            Jede Zeile unten stellt zwei Wege gegenüber, die dasselbe Ergebnis liefern müssen.
            Weichen sie ab, stimmt eine Annahme nicht mehr — die betroffene Zahl gehört
            geprüft, bevor sie in einen Bericht wandert.
          </>
        ) : (
          <>
            <b>Alle {ergebnisse.length} Prüfungen bestanden.</b> Jede Zeile unten stellt zwei
            unabhängige Rechenwege gegenüber. Dass sie übereinstimmen, heißt: die Zahlen des
            Cockpits sind in sich schlüssig und decken sich mit der SAP-Auswertung.
          </>
        )}
      </div>

      {/* ------------------------------------------- Bestandsdeckung
          Die eigentliche Frage, und zwar vor der Altersfrage: geht die
          Rechnung auf?  Kosten = berechnet + Bestandsveraenderung +
          Ergebnis.  Bleibt eine Luecke, stimmt eine der drei Groessen
          nicht. */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kontrolle</div>
            <h2>Bestände gegen die Kosten</h2>
          </div>
          <span className={`chip ${deckung.length ? 'neg' : 'pos'}`}>
            {deckung.length ? `${zahl(deckung.length)} Befunde` : 'alles gedeckt'}
          </span>
        </div>

        {deckung.length > 0 && (
          <div className="card-body" style={{ paddingBottom: 6 }}>
            <RangChart farben={{ positiv: '#b45309', negativ: '#be123c' }}
              zeilen={deckung.slice(0, 12).map(d => ({
              label: `${d.projektname ?? d.auftrag}`,
              wert: num(d.luecke),
              hinweis: `Kosten ${eur0(d.kosten)} · berechnet ${eur0(d.erloes)} · Bestandsv. ${eur0(d.bestandsveraenderung)}`,
            }))} />
            <div className="legend">
              <span><i style={{ background: '#b45309' }} />Kosten nicht gedeckt – Ergebnis zu schlecht</span>
              <span><i style={{ background: '#be123c' }} />mehr berechnet oder aktiviert – Ergebnis zu früh</span>
            </div>
          </div>
        )}

        <div className="card-body flush">
          {BEFUNDE.map(b => {
            const teil = deckung.filter(d => d.befund === b.key);
            if (!teil.length) return null;
            return (
              <details key={b.key} className="region-details" open={b.ton === 'neg'}>
                <summary>
                  <span className={`chip ${b.ton}`}>{zahl(teil.length)}</span>{' '}
                  <b style={{ marginLeft: 6 }}>{b.titel}</b>
                  <span className="muted num" style={{ marginLeft: 8 }}>
                    {eur0(teil.reduce((a, d) => a + Math.abs(num(d.luecke)), 0))}
                  </span>
                </summary>
                <div style={{ padding: '0 16px 14px' }}>
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{b.was}</p>
                  <div className="tablewrap">
                    <table className="data compact">
                      <thead>
                        <tr><th>Projekt</th><th>Region</th>
                            <th className="r">Kosten</th><th className="r">berechnet</th>
                            <th className="r">Bestandsv.</th><th className="r">Lücke</th>
                            <th className="r">Deckung</th><th className="r">Rg.</th>
                            <th className="r">Tage</th></tr>
                      </thead>
                      <tbody>
                        {teil.map(d => (
                          <tr key={d.auftrag}>
                            <td>
                              <Link href={`/projekte/${d.auftrag}`}><b>{d.projektname ?? d.auftrag}</b></Link>
                              <div className="muted mono" style={{ fontSize: 11 }}>{d.auftrag}</div>
                            </td>
                            <td className="muted">{d.region}</td>
                            <td className="r num">{eur0(d.kosten)}</td>
                            <td className="r num">{eur0(d.erloes)}</td>
                            <td className="r num">{eur0(d.bestandsveraenderung)}</td>
                            <td className={`r num ${num(d.luecke) > 0 ? 'pos' : 'neg'}`}>
                              <b>{eur0(d.luecke)}</b></td>
                            <td className="r num muted">{d.deckung === null ? '–' : pct(d.deckung)}</td>
                            <td className="r num muted">{zahl(d.rechnungen)}</td>
                            <td className="r num muted">{zahl(d.tage_ohne_rechnung)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          })}
          {!deckung.length && (
            <p style={{ margin: 0, padding: '0 16px 14px' }}>
              Bei jedem Auftrag gehen Kosten, berechnete Leistung und Bestandsveränderung
              innerhalb von {eur0(grenzen.luecke)} auf.
            </p>
          )}
        </div>
      </div>

      {/* ------------------------------------------- Bestandskontrolle
          Bewusst keine Pruefung mit Soll und Ist: dass ein Projekt Bestand
          traegt, ist kein Fehler des Systems, sondern eine Lage im
          Geschaeft.  Sie gehoert beobachtet, nicht bestanden. */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kontrolle</div>
            <h2>Bestand ohne Rechnung</h2>
          </div>
          <span className={`chip ${bestandOffen.length ? 'warn' : 'pos'}`}>
            {bestandOffen.length
              ? `${bestandOffen.length} über ${grenzen.tage} Tage`
              : 'nichts über der Frist'}
          </span>
        </div>
        <div className="card-body">
          {bestandOffen.length ? (
            <>
              <div className="deflist">
                <div><b>Betroffene Projekte</b><span>{zahl(bestandOffen.length)} von{' '}
                  {zahl(bestand.length)} mit Bestand über {eur(grenzen.bagatelle)}</span></div>
                <div><b>Gebundene Leistung</b><span className="num">
                  {eur(bestandOffen.reduce((a, b) => a + num(b.bestand), 0))}</span></div>
                <div><b>Ältester Fall</b><span>
                  {(() => {
                    /* Der aelteste Fall ist nicht der groesste – die Liste ist nach
                       Betrag sortiert, gesucht ist hier das hoechste Alter. */
                    const alt = bestandOffen.reduce((a, b) =>
                      num(b.tage_ohne_rechnung) > num(a.tage_ohne_rechnung) ? b : a);
                    return <>{zahl(alt.tage_ohne_rechnung)} Tage ·{' '}
                      <span className="mono">{alt.auftrag}</span>
                      {alt.projektname && <span className="muted"> · {alt.projektname}</span>}</>;
                  })()}</span></div>
              </div>
              <p className="muted" style={{ marginBottom: 0 }}>
                Die Liste mit Beträgen und Terminen steht unter{' '}
                <Link href="/projekte" style={{ color: 'var(--accent)' }}>Projekte</Link>.
                Gemessen wird gegen den Stand der Daten, nicht gegen das heutige Datum.
              </p>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              Kein Projekt trägt Bestand, der länger als {grenzen.tage} Tage ohne Rechnung liegt.
            </p>
          )}
        </div>
      </div>

      {gruppen.map(g => {
        const teil = ergebnisse.filter(e => e.gruppe === g);
        const offen = teil.filter(e => !e.bestanden).length;
        return (
          <div className="card" key={g}>
            <div className="card-head">
              <div>
                <div className="eyebrow">{offen ? `${offen} offen` : 'Vollständig'}</div>
                <h2>{g}</h2>
              </div>
              <span className={`chip ${offen ? 'neg' : 'pos'}`}>
                {teil.length - offen} / {teil.length}
              </span>
            </div>
            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }} />
                      <th>Prüfung</th>
                      <th className="r">Gerechnet</th>
                      <th className="r">Gegenprobe</th>
                      <th className="r fix-r">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teil.map(e => {
                      const abw = e.istWert !== null && e.sollWert !== null
                        ? e.istWert - e.sollWert : null;
                      return (
                        <tr key={e.name}>
                          <td className={e.bestanden ? 'pos' : 'neg'}
                              style={{ fontWeight: 700, textAlign: 'center' }}>
                            {e.bestanden ? '✓' : '✗'}
                          </td>
                          <td>
                            {e.name}
                            <span className="formula">{e.erklaerung}</span>
                            {e.fehler && <span className="formula neg">{e.fehler}</span>}
                          </td>
                          <td className="r num">{wert(e, e.istWert)}</td>
                          <td className="r num muted">{wert(e, e.sollWert)}</td>
                          <td className={`r num fix-r ${e.bestanden ? 'muted' : 'neg'}`}>
                            {abw === null ? '–'
                              : Math.abs(abw) < 0.005 ? '0,00'
                              : wert(e, abw)}
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
      })}

      <div className="card">
        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Dieselben Prüfungen laufen auch von der Kommandozeile — etwa nach einem Import
            oder aus einem Zeitplan heraus:
          </p>
          <pre className="mono" style={{ marginTop: 8, marginBottom: 8 }}>
            python3 scripts/alles-pruefen.py {jahr}
          </pre>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Rückgabewert 0, wenn alles stimmt, sonst 1. Die Rechenwege hinter den einzelnen
            Größen stehen unter <Link href="/methodik" style={{ color: 'var(--accent)' }}>Rechenwege</Link>,
            der Kontenabgleich unter <Link href="/abstimmung" style={{ color: 'var(--accent)' }}>Abstimmung</Link>.
          </p>
        </div>
      </div>
    </Shell>
  );
}
