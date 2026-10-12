import Link from 'next/link';
import Shell from '../../components/Shell';
import Testcenter from './Testcenter';
import { requireRecht } from '@/lib/guard';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function TestcenterSeite() {
  const benutzer = await requireRecht('klr.read');

  const r = await pool.query(`
    SELECT projekt_nr, projektname, hat_bestandsveraenderung
      FROM controlling.v_projekt_bestandsveraenderung
     ORDER BY hat_bestandsveraenderung DESC, projekt_nr`);
  const beispiele = r.rows.map((x: Record<string, unknown>) => ({
    nr: String(x.projekt_nr), name: String(x.projektname ?? ''),
    hatBv: Boolean(x.hat_bestandsveraenderung),
  }));
  const mit = beispiele.filter(b => b.hatBv).length;

  return (
    <Shell titel="Testcenter Bestandsveränderung"
           bereich="Probelauf ohne Buchung" aktiv="saptest" benutzer={benutzer}
           aktion={<span className="chip info">{mit} von {beispiele.length} Aufträgen mit BV</span>}>

      <div className="note">
        <b>Hier entsteht ein vollständiger Beleg – aber keiner, der zählt.</b> Er bekommt keine
        Belegnummer aus der Nummernfolge, sondern die Kennung <span className="mono">TEST-NICHT-GEBUCHT</span>,
        und wird nirgends gespeichert: kein Eintrag in den Buchungstabellen, keine Zeile im
        Audit-Protokoll, keine Auswirkung auf Ergebnis oder Bilanz. Zum Buchen geht es in
        die <Link href="/sap" style={{ color: 'var(--accent)' }}>SAP-Buchungsmaske</Link>.
      </div>
      <Testcenter beispiele={beispiele} />
    </Shell>
  );
}
