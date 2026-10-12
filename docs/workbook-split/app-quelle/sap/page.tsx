import Shell from '../components/Shell';
import BuchungsMaske from './BuchungsMaske';
import { requireUser } from '@/lib/guard';
import { pool } from '@/lib/db';
import { eur0, datum, datumZeit, zahl } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SapSeite() {
  const benutzer = await requireUser();

  const [belege, konten, auftraege] = await Promise.all([
    pool.query(`
      SELECT k.*, b.email, COUNT(z.sap_zeile_id) zeilen,
             COALESCE(SUM(CASE WHEN z.buchungsschluessel IN ('01','21','40','70') THEN z.betrag ELSE 0 END),0) soll
        FROM controlling.sap_buchungskopf k
        LEFT JOIN controlling.sap_buchungszeile z ON z.sap_buchung_id=k.sap_buchung_id
        LEFT JOIN controlling.benutzer b ON b.benutzer_id=k.benutzer_id
       GROUP BY k.sap_buchung_id, b.email ORDER BY k.erstellt_at DESC LIMIT 50`),
    pool.query(`SELECT kostenart_nr, bezeichnung FROM controlling.kostenarten ORDER BY kontonummer`),
    pool.query(`SELECT projekt_nr, projektname FROM controlling.projekte ORDER BY projekt_nr`),
  ]);

  return (
    <Shell titel="SAP-Buchungsmaske" bereich="FI-Beleg erfassen und exportieren" aktiv="sap" benutzer={benutzer}
           aktion={<a className="btn" href="/api/import/vorlage">Buchungsvorlage als Excel</a>}>
      <BuchungsMaske
        konten={konten.rows.map(k => ({ nr: String(k.kostenart_nr).replace(/\.0$/, ''), bez: k.bezeichnung }))}
        auftraege={auftraege.rows.map(a => ({ nr: a.projekt_nr, name: a.projektname }))}
      />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Protokoll</div>
            <h2>Erfasste Belege</h2>
            <p>Die 50 zuletzt gespeicherten Belege.</p>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Beleg</th><th>Erfasst</th><th>Benutzer</th><th>BuKr</th><th>Belegdatum</th>
                    <th>Buchungsdatum</th><th>Art</th><th>Referenz</th>
                    <th className="r">Zeilen</th><th className="r">Betrag</th></tr>
              </thead>
              <tbody>
                {belege.rows.map(b => (
                  <tr key={b.sap_buchung_id}>
                    <td className="mono"><b>{b.sap_buchung_id}</b></td>
                    <td className="muted">{datumZeit(b.erstellt_at)}</td>
                    <td className="muted">{b.email ?? '–'}</td>
                    <td className="mono">{b.buchungskreis}</td>
                    <td>{datum(b.belegdatum)}</td>
                    <td>{datum(b.buchungsdatum)}</td>
                    <td>{b.belegart}</td>
                    <td className="muted">{b.referenz || '–'}</td>
                    <td className="r num">{zahl(b.zeilen)}</td>
                    <td className="r num">{eur0(b.soll)}</td>
                  </tr>
                ))}
                {!belege.rows.length && (
                  <tr><td colSpan={10}><div className="empty">Noch kein Beleg erfasst.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
