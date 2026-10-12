import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';
import { kostenartenStamm, klassifizierungAbgleich } from '@/lib/queries';
import { eur0, zahl, vz, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STUFEN: Record<number, { name: string; text: string; ton: string }> = {
  0: { name: 'Betriebsleistung', ton: 'info',
       text: 'Erlöskonten und Bestandsveränderung. Fließen als Leistung in DB1 ein.' },
  1: { name: 'Variable Einzelkosten', ton: 'neg',
       text: 'Leistungsabhängig und direkt dem Auftrag zurechenbar. Abzug in DB1.' },
  2: { name: 'Fixe Kosten', ton: 'neg',
       text: 'Zeitabhängig. Auf Projektaufträgen Abzug in DB2, auf Innenaufträgen Gemeinkosten in DB3/DB4.' },
  9: { name: 'Neutrales Ergebnis', ton: 'warn',
       text: 'Außerhalb der Betriebsleistung: sonstige betriebliche Erträge (in der GuV im EBITDA), Zinsen, Ertragsteuern, periodenfremde Posten, kalkulatorische Kosten.' },
};

export default async function KostenartenSeite() {
  const benutzer = await requireRecht('klr.read');
  const [konten, abgleich] = await Promise.all([kostenartenStamm(), klassifizierungAbgleich()]);

  const tvf = konten.filter(k => k.quelle === 'TVF-Kontenstamm').length;
  const hergeleitet = konten.length - tvf;
  const gemeinsam = konten.filter(k => k.quelle === 'TVF-Kontenstamm' && k.belege > 0).length;

  const geprueft = abgleich.length;
  const deckungsgleich = abgleich.filter(a => a.stimmt_ueberein).length;
  const abweichungen = abgleich.filter(a => !a.stimmt_ueberein && a.belege > 0);

  const stufen = [0, 1, 2, 9];

  return (
    <Shell titel="Kostenartenstamm" bereich="Grundlagen der Klassifizierung" aktiv="kostenarten" benutzer={benutzer}
           aktion={<span className="chip info">{konten.length} Konten</span>}>
      <div className="note">
        <b>{tvf} Konten aus dem GuV-Kontenstamm</b>, {hergeleitet} Konten – überwiegend
        CO-interne Konten wie Lohn- und Geräteverrechnung, Gemeinkostenzuschlag und kalkulatorische Kosten –
        werden nach Kontonummernkreis eingeordnet (<span className="mono">db/01_modell.sql</span>).
        Bei den {gemeinsam} Konten, die in beiden Quellen vorkommen, stimmen beide Verfahren
        vollständig überein.
      </div>

      {!!geprueft && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Gegenprobe</div>
              <h2>Abgleich mit dem TVF-Kontenkatalog</h2>
            </div>
            <span className={`chip ${abweichungen.length ? 'warn' : 'pos'}`}>
              {deckungsgleich} von {geprueft} deckungsgleich
            </span>
          </div>
          <div className="card-body">
            {abweichungen.length === 0 ? (
              <p style={{ margin: 0 }}>Keine bebuchte Kostenart weicht ab.</p>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  {abweichungen.length} bebuchte {abweichungen.length === 1 ? 'Kostenart weicht' : 'Kostenarten weichen'} ab.
                  Beide Einordnungen halten die Beträge außerhalb des Deckungsbeitrags bzw. innerhalb der
                  Betriebskosten – die Wirkung auf DB1 bis DB4 ist in beiden Fällen null.
                </p>
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th>Konto</th><th>Bezeichnung</th><th>eigene Einordnung</th>
                          <th>Kontenkatalog</th><th className="r">Saldo</th><th>Bewertung</th></tr>
                    </thead>
                    <tbody>
                      {abweichungen.map(a => (
                        <tr key={a.kostenart_nr}>
                          <td className="mono">{a.kostenart_nr.replace(/\.0$/, '')}</td>
                          <td><b>{a.bezeichnung}</b></td>
                          <td>DB-Stufe {a.db_stufe} · <span className="muted">{a.klr_typ}</span></td>
                          <td className="muted">{a.kategorie_text}</td>
                          <td className="r num">{eur0(a.saldo)}</td>
                          <td className="muted">
                            {a.kontonummer === 430020
                              ? 'Gewerbeertragsteuer ist eine Steuer vom Einkommen und Ertrag (§ 275 HGB) und steht deshalb hier im neutralen Ergebnis. Der ältere GuV-Kontenstamm ordnet sie ebenso ein.'
                              : 'abweichende Untergliederung ohne Ergebniswirkung'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Regelwerk</div>
            <h2>Nummernkreise und ihre Zuordnung</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="deflist">
            <div><b>300000 – 349999</b><span>Material, Hilfs- und Betriebsstoffe, Fremdleistungen → variable Einzelkosten (DB1)</span></div>
            <div><b>401000, 420060, 440050</b><span>Diesel, eigene Entsorgung, Transport → variable Einzelkosten (DB1)</span></div>
            <div><b>7611xxx, 7612000</b><span>Lohn- und Geräteverrechnung aus eigenen Kostenstellen → variable Einzelkosten (DB1)</span></div>
            <div><b>7801020</b><span>Gemeinkostenzuschlag: entlastet den Innenauftrag der Region, belastet das Projekt → DB3</span></div>
            <div><b>400000 – 489999 (übrige)</b><span>Fuhrpark, Personal, Raum, Versicherungen, Verwaltung, Abschreibungen → fixe Kosten</span></div>
            <div><b>830000 – 869999, 890100, 890800</b><span>Erlöse und Erlösschmälerungen → Betriebsleistung</span></div>
            <div><b>252000, 274200, 287090</b><span>Sonstige betriebliche Erträge (SAP-Position 003043) → EBITDA, nicht in die Betriebsleistung</span></div>
            <div><b>392000</b><span>Bestandsveränderung unfertige Leistungen → Betriebsleistung</span></div>
            <div><b>272000, 273500, 890010</b><span>Anlagenverkäufe und periodenfremde Posten (SAP-Position 003041) → neutrales Ergebnis</span></div>
            <div><b>210000 – 213999, 220000, 221200, 401030, 430010, 430020, 430040</b><span>Zinsen, Kfz-Steuer und übrige Steuern → neutrales Ergebnis</span></div>
            <div><b>289200, 289300, 499200, 499300</b><span>Kalkulatorische Zinsen und Abschreibungen samt Verrechnung → neutrales Ergebnis (saldieren sich)</span></div>
          </div>
        </div>
      </div>

      {stufen.map(stufe => {
        const rows = konten.filter(k => k.db_stufe === stufe);
        if (!rows.length) return null;
        const summe = rows.reduce((a, k) => a + (stufe === 0 ? -num(k.wert) : num(k.wert)), 0);
        return (
          <div className="card" key={stufe}>
            <div className="card-head">
              <div>
                <div className="eyebrow">DB-Stufe {stufe}</div>
                <h2>{STUFEN[stufe].name}</h2>
              </div>
              <span className={`chip ${STUFEN[stufe].ton}`}>{rows.length} Konten · {eur0(summe)}</span>
            </div>
            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data compact">
                  <thead>
                    <tr>
                      <th>Konto</th><th>Bezeichnung</th><th>Kontoart</th><th>Planungsgruppe</th>
                      <th>Kostenblock</th><th>EBITDA</th><th>Zuordnung aus</th>
                      <th className="r">Belege</th><th className="r">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(k => (
                      <tr key={k.kostenart_nr} style={k.belege ? undefined : { opacity: .5 }}>
                        <td className="mono">
                          {k.belege
                            ? <Link href={`/buchungen?kostenart=${encodeURIComponent(k.kostenart_nr)}`} style={{ color: 'var(--accent)' }}>
                                {k.kostenart_nr.replace(/\.0$/, '')}
                              </Link>
                            : k.kostenart_nr.replace(/\.0$/, '')}
                        </td>
                        <td>{k.bezeichnung}
                          <div className="muted" style={{ fontSize: 11 }}>{k.klr_typ}</div></td>
                        <td className="muted">{k.kontoart}</td>
                        <td className="muted">{k.planungsgruppe}</td>
                        <td className="muted">{k.kostenblock || '–'}</td>
                        <td>{k.ebitda_relevant ? <span className="chip pos">ja</span> : <span className="muted">nein</span>}</td>
                        <td>
                          <span className={`chip ${k.quelle === 'TVF-Kontenstamm' ? 'info' : ''}`}>
                            {k.quelle === 'TVF-Kontenstamm' ? 'Kontenstamm' : 'Nummernkreis'}
                          </span>
                        </td>
                        <td className="r num muted">{zahl(k.belege)}</td>
                        <td className={`r num ${vz(stufe === 0 ? -num(k.wert) : num(k.wert))}`}>
                          {k.belege ? eur0(stufe === 0 ? -num(k.wert) : num(k.wert)) : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </Shell>
  );
}
