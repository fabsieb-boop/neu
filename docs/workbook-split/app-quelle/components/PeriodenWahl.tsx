import { MONATE } from '@/lib/format';
import type { Zeitraum } from '@/lib/zeitraum';

const M = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Zeitraumauswahl als reines GET-Formular – funktioniert ohne Client-JavaScript.
 * `pfad` ist das Ziel, `felder` optionale zusätzliche versteckte Filter.
 *
 * Mit `zeitraum` erscheinen zwei Felder "Von" und "Bis"; damit lässt sich jede
 * Auswertung auf einen Monat oder eine Spanne einschränken. Ein einzelner
 * Monat ist dabei nur der Fall von = bis.
 *
 * Die ältere Form mit `monate`/`monat` (ein einzelnes Feld "Periode") bleibt
 * bestehen, solange noch Seiten sie nutzen.
 */
export default function PeriodenWahl({
  pfad, jahre, jahr, monate, monat, zeitraum,
  alleMonateLabel = 'Gesamtes Jahr', felder = {}, kinder,
}: {
  pfad: string;
  jahre: number[];
  jahr: number;
  monate?: number[];
  monat?: number | null;
  zeitraum?: Zeitraum;
  alleMonateLabel?: string;
  felder?: Record<string, string | undefined>;
  kinder?: React.ReactNode;
}) {
  return (
    <form className="toolbar" method="get" action={pfad}>
      {Object.entries(felder).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null)}

      <div className="field">
        <label htmlFor="jahr">Geschäftsjahr</label>
        <select id="jahr" name="jahr" defaultValue={String(jahr)}>
          {jahre.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </div>

      {zeitraum && (
        <>
          <div className="field">
            <label htmlFor="von">Von</label>
            <select id="von" name="von" defaultValue={String(zeitraum.von)}>
              {M.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} – {MONATE[m]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bis">Bis</label>
            <select id="bis" name="bis" defaultValue={String(zeitraum.bis)}>
              {M.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} – {MONATE[m]}</option>)}
            </select>
          </div>
        </>
      )}

      {monate && (
        <div className="field">
          <label htmlFor="monat">Periode</label>
          <select id="monat" name="monat" defaultValue={monat ? String(monat) : ''}>
            <option value="">{alleMonateLabel}</option>
            {monate.map(m => <option key={m} value={m}>{m.toString().padStart(2, '0')} – {MONATE[m]}</option>)}
          </select>
        </div>
      )}

      {kinder}

      <button className="btn primary" type="submit">Anzeigen</button>
    </form>
  );
}
