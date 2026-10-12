import Link from 'next/link';
import Shell from '../../components/Shell';
import Baukasten from './Baukasten';
import Unterseiten from '../../components/Unterseiten';
import { UNTERSEITEN } from '../unterseiten';
import RegionsHinweis from '../../components/RegionsHinweis';
import { requireRecht } from '@/lib/guard';
import { pool } from '@/lib/db';
import { quellen } from '@/lib/baukasten';

export const dynamic = 'force-dynamic';

export default async function BaukastenSeite() {
  const benutzer = await requireRecht('bericht.read');

  const [qs, vorlagen] = await Promise.all([
    quellen(),
    pool.query(`SELECT v.id, v.name, v.beschreibung, v.quelle, v.aufbau,
                       v.geaendert_at::text, b.email AS erstellt_von
                  FROM controlling.bericht_vorlage v
                  LEFT JOIN controlling.benutzer b ON b.benutzer_id = v.erstellt_von
                 ORDER BY v.name`),
  ]);

  return (
    <Shell titel="Berichtsbaukasten" bereich="Eigene Auswertungen zusammenstellen"
           aktiv="bericht" benutzer={benutzer}
           aktion={<Link className="btn" href="/bericht">Feste Berichte</Link>}>
      <Unterseiten seiten={UNTERSEITEN} aktiv="baukasten" />
      <RegionsHinweis benutzer={benutzer} />
      <Baukasten quellen={qs} vorlagen={vorlagen.rows} />
    </Shell>
  );
}
