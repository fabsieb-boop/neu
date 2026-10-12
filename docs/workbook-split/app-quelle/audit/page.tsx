import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';
import { pool } from '@/lib/db';
import { datumZeit } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditSeite() {
  const benutzer = await requireRecht('audit.read');
  const r = await pool.query(
    `SELECT a.*, b.email FROM controlling.audit_log a
       LEFT JOIN controlling.benutzer b ON b.benutzer_id=a.benutzer_id
      ORDER BY a.erstellt_at DESC LIMIT 500`);

  return (
    <Shell titel="Audit-Protokoll" bereich="Nachvollziehbarkeit von Änderungen" aktiv="audit" benutzer={benutzer}
           aktion={<span className="chip info">{r.rowCount} Einträge</span>}>
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Protokoll</div><h2>Letzte 500 Einträge</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Zeitpunkt</th><th>Benutzer</th><th>Aktion</th><th>Objekt</th><th>Details</th></tr></thead>
              <tbody>
                {r.rows.map(z => (
                  <tr key={z.audit_id}>
                    <td className="muted">{datumZeit(z.erstellt_at)}</td>
                    <td>{z.email ?? <span className="muted">System</span>}</td>
                    <td><span className="chip">{z.aktion}</span></td>
                    <td className="muted">{z.objekt} {z.objekt_id}</td>
                    <td className="mono muted" style={{ maxWidth: 520, overflowWrap: 'anywhere' }}>
                      {JSON.stringify(z.details ?? {})}
                    </td>
                  </tr>
                ))}
                {!r.rows.length && <tr><td colSpan={5}><div className="empty">Noch keine Einträge.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
