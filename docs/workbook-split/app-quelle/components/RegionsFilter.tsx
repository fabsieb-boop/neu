import { pool } from '@/lib/db';

export type RegionsAuswahl = { region: string; auftrag: string };

/**
 * Liest Region und Auftragsfilter aus den Suchparametern.
 * Beide Werte werden getrimmt; leere Angaben bedeuten "alles".
 */
export function filterLesen(sp: Record<string, string>): RegionsAuswahl {
  return {
    region: (sp.region ?? '').trim(),
    auftrag: (sp.auftrag ?? '').trim(),
  };
}

/**
 * Die gepflegten Regionen, in der Reihenfolge aus den Einstellungen.
 * Ist `erlaubt` gesetzt und nicht leer, wird die Liste darauf beschraenkt –
 * so sieht ein Regionalleiter im Auswahlfeld gar nicht erst die Regionen,
 * auf die er keinen Zugriff hat.
 */
export async function regionenListe(erlaubt?: string[]): Promise<string[]> {
  return (await regionenMitUmfang(erlaubt)).regionen;
}

/**
 * Die Regionen dieses Benutzers – und ob das weniger sind als alle.
 *
 * „Regionen zugeordnet" heisst nicht „eingeschraenkt": wer fuer alle fuenf
 * freigegeben ist, sieht das ganze Unternehmen.  Wird das verwechselt,
 * verschwindet die Auswahl „alle Regionen" aus der Liste, und das
 * Auswahlfeld zeigt die erste Region an, obwohl gar nicht gefiltert wird.
 * Genau so sah es auf der Risikoseite aus: oben West, darunter alle
 * Regionen.
 */
export async function regionenMitUmfang(erlaubt?: string[]) {
  const r = await pool.query(
    `SELECT region FROM controlling.region_einstellung
      WHERE region <> '*' AND aktiv ORDER BY sortierung, region`);
  const alle = r.rows.map(x => x.region as string);
  const regionen = erlaubt?.length ? alle.filter(x => erlaubt.includes(x)) : alle;
  return { regionen, alle, eingeschraenkt: regionen.length < alle.length };
}

/**
 * Vorschlaege fuer das Suchfeld: Nummer und Bezeichnung jedes Auftrags.
 *
 * Als echtes <datalist>, nicht als eigene Bedienung – der Browser filtert
 * selbst, sobald die ersten Zeichen stehen, und es funktioniert ohne
 * JavaScript.  Weil die Leiste auf jeder Auswertungsseite steht, bekommen
 * damit alle Suchfelder auf einmal ihre Vorschlaege.
 */
async function auftragsVorschlaege() {
  const r = await pool.query(`
    SELECT projekt_nr, projektname FROM controlling.projekte
     WHERE auftragstyp = 'PROJEKT'
     ORDER BY projekt_nr LIMIT 600`);
  return r.rows as { projekt_nr: string; projektname: string | null }[];
}

/**
 * Filterleiste als reines GET-Formular – wie PeriodenWahl ohne
 * Client-JavaScript nutzbar und damit auch im Ausdruck nachvollziehbar.
 *
 * `felder` nimmt alles auf, was beim Filtern erhalten bleiben soll,
 * typischerweise das Geschäftsjahr.
 */
export default async function RegionsFilter({
  pfad, region, auftrag, felder = {}, auftragLabel = 'Auftrag oder Projekt',
  erlaubt, kinder,
}: {
  pfad: string;
  region: string;
  auftrag?: string;
  felder?: Record<string, string | number | undefined>;
  auftragLabel?: string;
  /** Regionen dieses Benutzers; leer heisst keine Einschraenkung. */
  erlaubt?: string[];
  kinder?: React.ReactNode;
}) {
  const { regionen, eingeschraenkt } = await regionenMitUmfang(erlaubt);
  const aktiv = !!region || !!auftrag;
  const vorschlaege = auftrag !== undefined
    ? await auftragsVorschlaege().catch(() => [])
    : [];

  return (
    <form className="toolbar" method="get" action={pfad}>
      {Object.entries(felder).map(([k, v]) =>
        v !== undefined && v !== '' ? <input key={k} type="hidden" name={k} value={String(v)} /> : null)}

      <div className="field">
        <label htmlFor="region">Region</label>
        <select id="region" name="region" defaultValue={region}>
          {/* Die leere Auswahl gibt es immer, solange es mehr als eine
              Region gibt – sonst zeigt das Feld eine Region an, nach der
              gar nicht gefiltert wird. */}
          {regionen.length > 1 && (
            <option value="">{eingeschraenkt ? 'meine Regionen' : 'alle Regionen'}</option>
          )}
          {regionen.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {auftrag !== undefined && (
        <div className="field feld-breit">
          <label htmlFor="auftrag">{auftragLabel}</label>
          <input id="auftrag" name="auftrag" type="search" defaultValue={auftrag}
                 list="auftragsvorschlaege" placeholder="Nummer oder Bezeichnung"
                 autoComplete="off" />
          <datalist id="auftragsvorschlaege">
            {vorschlaege.map(p => (
              <option key={p.projekt_nr} value={p.projekt_nr}>{p.projektname ?? ''}</option>
            ))}
            {[...new Set(vorschlaege.map(p => p.projektname).filter(Boolean))].map(n => (
              <option key={`n-${n}`} value={n as string} />
            ))}
          </datalist>
        </div>
      )}

      {kinder}

      <div className="toolbar-aktionen">
        <button className="btn primary" type="submit">Filtern</button>
        {aktiv && (
          <a className="btn" href={`${pfad}${Object.entries(felder)
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v], i) => `${i ? '&' : '?'}${k}=${encodeURIComponent(String(v))}`)
            .join('')}`}>Zurücksetzen</a>
        )}
      </div>
    </form>
  );
}
