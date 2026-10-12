import type { Benutzer } from '@/lib/guard';
import { schutzHinweis } from '@/lib/regionsschutz';

/**
 * Weist darauf hin, dass die Zahlen dieser Seite auf die freigegebenen
 * Regionen beschränkt sind. Ohne diesen Hinweis hielte ein Regionalleiter
 * seine Teilsumme für die Gesamtsumme.
 */
export default function RegionsHinweis({ benutzer }: { benutzer: Benutzer }) {
  const text = schutzHinweis(benutzer);
  if (!text) return null;
  return (
    <div className="note">
      <b>Eingeschränkte Sicht.</b> {text}
    </div>
  );
}
