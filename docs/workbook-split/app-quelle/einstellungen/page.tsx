import Shell from '../components/Shell';
import Einstellungen from './Einstellungen';
import Monatsfreigabe from './Monatsfreigabe';
import { requireRecht } from '@/lib/guard';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EinstellungenSeite() {
  const benutzer = await requireRecht('users.write');

  const [app, regionen] = await Promise.all([
    pool.query(`SELECT schluessel, wert, beschreibung
                  FROM controlling.app_einstellung ORDER BY schluessel`),
    pool.query(`SELECT region, codes, langname, anschrift, leitung, telefon, email,
                       farbe, sharepoint_url, sortierung, aktiv,
                       (logo IS NOT NULL)      AS hat_logo,
                       logo_name,
                       octet_length(logo)      AS logo_bytes
                  FROM controlling.region_einstellung
                 WHERE region <> '*' ORDER BY sortierung, region`),
    ]);

  /* Der Zeitraum, den das Cockpit rechnet, haengt an diesen Schaltern -
     deshalb stehen sie hier und nicht in einer Auswertung. */
  const jahr = (await pool.query(
    `SELECT max(EXTRACT(year FROM buchungsdatum))::int AS jahr
       FROM controlling.sap_einzelposten`)).rows[0]?.jahr ?? new Date().getFullYear();
  const perioden = await pool.query(
    `SELECT monat, belege, fuellgrad, belastbar, freigabe, belastbar_effektiv
       FROM controlling.v_periode_status WHERE jahr = $1 ORDER BY monat`, [jahr]);

  const firma = await pool.query(
    `SELECT (logo IS NOT NULL) AS hat_logo, logo_name, octet_length(logo) AS logo_bytes
       FROM controlling.region_einstellung WHERE region = '*'`);

  return (
    <Shell titel="Einstellungen" bereich="Firma, Regionen und Berichtskopf"
           aktiv="einstellungen" benutzer={benutzer}>
      <Monatsfreigabe jahr={jahr} perioden={perioden.rows} />

      <Einstellungen
        app={app.rows}
        regionen={regionen.rows}
        firma={firma.rows[0] ?? { hat_logo: false, logo_name: null, logo_bytes: 0 }}
      />
    </Shell>
  );
}
