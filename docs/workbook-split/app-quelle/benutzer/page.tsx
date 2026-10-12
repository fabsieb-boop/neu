import Shell from '../components/Shell';
import BenutzerVerwaltung from './BenutzerVerwaltung';
import { requireRecht } from '@/lib/guard';
import { pool } from '@/lib/db';
import { regionenListe } from '../components/RegionsFilter';

export const dynamic = 'force-dynamic';

export default async function BenutzerSeite() {
  const benutzer = await requireRecht('users.read');

  const [users, rollen, rechte, matrix] = await Promise.all([
    pool.query(`SELECT b.benutzer_id,b.email,b.vorname,b.nachname,b.aktiv,b.letzter_login,b.fehlversuche,
                       b.gesperrt_bis, b.passwort_aendern, b.regionen,
                       COALESCE(array_agg(DISTINCT r.rollenname) FILTER(WHERE r.rollenname IS NOT NULL),'{}') rollen
                  FROM controlling.benutzer b
                  LEFT JOIN controlling.benutzer_rollen br ON br.benutzer_id=b.benutzer_id
                  LEFT JOIN controlling.rollen r ON r.rollen_id=br.rollen_id
                 GROUP BY b.benutzer_id ORDER BY b.email`),
    pool.query(`SELECT rollen_id,rollenname,beschreibung FROM controlling.rollen ORDER BY rollenname`),
    pool.query(`SELECT berechtigung_id,code,beschreibung FROM controlling.berechtigungen ORDER BY code`),
    pool.query(`SELECT rb.rollen_id,b.code FROM controlling.rollen_berechtigungen rb
                  JOIN controlling.berechtigungen b ON b.berechtigung_id=rb.berechtigung_id`),
  ]);

  const regionen = await regionenListe();

  return (
    <Shell titel="Benutzer und Rechte" bereich="Rollenbasierte Zugriffssteuerung" aktiv="benutzer" benutzer={benutzer}>
      <BenutzerVerwaltung
        benutzer={users.rows}
        rollen={rollen.rows}
        rechte={rechte.rows}
        matrix={matrix.rows}
        regionen={regionen}
        ich={benutzer.benutzer_id}
      />
    </Shell>
  );
}
