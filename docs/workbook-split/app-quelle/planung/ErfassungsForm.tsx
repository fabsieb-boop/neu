'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Feld = {
  name: string;
  label: string;
  typ?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'prozent';
  optionen?: { wert: string; text: string }[];
  vorgabe?: string | number;
  breite?: number;
  pflicht?: boolean;
  hinweis?: string;
};

/**
 * Erfassungsformular für die Planungsmodule. Sendet an /api/planung und lädt
 * die Seite neu, damit die Auswertungen darüber sofort stimmen.
 */
export default function ErfassungsForm({
  modul, felder, titel, beschreibung, knopf = 'Speichern', zusatz,
}: {
  modul: string; felder: Feld[]; titel: string; beschreibung?: string;
  knopf?: string; zusatz?: Record<string, unknown>;
}) {
  const router = useRouter();
  const start = () => Object.fromEntries(felder.map(f => [f.name, String(f.vorgabe ?? '')]));
  const [werte, setWerte] = useState<Record<string, string>>(start);
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Hat irgendein Feld einen Hinweis? Dann bekommt jedes seine Zeile. */
  const mitHinweisen = felder.some(f => f.hinweis);

  const FEHLERTEXT: Record<string, string> = {
    FORBIDDEN: 'Ihrer Rolle fehlt die Berechtigung für dieses Modul.',
    PROJEKT_UNBEKANNT: 'Diese Projektnummer gibt es nicht im Projektstamm.',
    BEZEICHNUNG_FEHLT: 'Bitte eine Bezeichnung angeben.',
    ZWECK_FEHLT: 'Bitte einen Zweck angeben.',
    AUFTRAGGEBER_FEHLT: 'Bitte den Auftraggeber angeben.',
    ZAHLUNGSPLAN_FEHLT: 'Ein Vertrag braucht mindestens eine Rate.',
    KUNDE_ODER_BEZEICHNUNG_FEHLT: 'Bitte Kunde und Bezeichnung angeben.',
  };

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    const fehlend = felder.filter(f => f.pflicht && !werte[f.name]?.trim());
    if (fehlend.length) {
      setStatus({ art: 'fehler', text: `Bitte ausfüllen: ${fehlend.map(f => f.label).join(', ')}` });
      return;
    }
    setLaeuft(true); setStatus(null);
    try {
      const nutzlast: Record<string, unknown> = { modul, ...zusatz };
      for (const f of felder) {
        const roh = werte[f.name];
        if (roh === '' || roh === undefined) continue;
        nutzlast[f.name] = f.typ === 'prozent' ? Number(roh) / 100
          : f.typ === 'number' ? Number(String(roh).replace(',', '.'))
          : roh;
      }
      const r = await fetch('/api/planung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nutzlast),
      });
      if (r.ok) {
        setWerte(start());
        setStatus({ art: 'ok', text: 'Gespeichert.' });
        router.refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setStatus({ art: 'fehler', text: FEHLERTEXT[d.error] ?? 'Speichern fehlgeschlagen.' });
      }
    } catch {
      setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' });
    } finally { setLaeuft(false); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Erfassung</div>
          <h2>{titel}</h2>
          {beschreibung && <p>{beschreibung}</p>}
        </div>
      </div>
      <form onSubmit={speichern}>
        {/* Traegt ein Feld einen Hinweis, bekommt ihn jedes – sonst waere seine
            Gruppe hoeher als die anderen, und weil die Leiste unten ausrichtet,
            stuende genau dieses Eingabefeld zwanzig Pixel ueber der Reihe. */}
        <div className="toolbar">
          {felder.map(f => (
            <div className="field" key={f.name} style={{ minWidth: f.breite ?? 150, flex: f.breite ? 1 : undefined }}>
              <label htmlFor={`${modul}-${f.name}`}>
                {f.label}{f.pflicht && <span style={{ color: 'var(--neg)' }}> *</span>}
              </label>
              {f.typ === 'select' ? (
                <select id={`${modul}-${f.name}`} value={werte[f.name] ?? ''}
                        onChange={e => setWerte({ ...werte, [f.name]: e.target.value })}>
                  {f.optionen?.map(o => <option key={o.wert} value={o.wert}>{o.text}</option>)}
                </select>
              ) : f.typ === 'textarea' ? (
                <textarea id={`${modul}-${f.name}`} rows={2} value={werte[f.name] ?? ''}
                          style={{ width: '100%' }}
                          onChange={e => setWerte({ ...werte, [f.name]: e.target.value })} />
              ) : (
                <input id={`${modul}-${f.name}`}
                       type={f.typ === 'number' || f.typ === 'prozent' ? 'number' : f.typ ?? 'text'}
                       step={f.typ === 'number' ? '0.01' : f.typ === 'prozent' ? '1' : undefined}
                       min={f.typ === 'prozent' ? 0 : undefined}
                       max={f.typ === 'prozent' ? 100 : undefined}
                       value={werte[f.name] ?? ''}
                       style={f.breite ? { width: '100%' } : undefined}
                       onChange={e => setWerte({ ...werte, [f.name]: e.target.value })} />
              )}
              {mitHinweisen && (
                <span className="muted" style={{ fontSize: 11, minHeight: 15 }}>
                  {f.hinweis ?? ''}
                </span>
              )}
            </div>
          ))}
          <div className="field">
            {/* Leere Beschriftung und leere Hinweiszeile: der Knopf steht damit
                auf derselben Grundlinie wie die Eingabefelder. */}
            <label aria-hidden="true">&nbsp;</label>
            <button className="btn primary" type="submit" disabled={laeuft}>
              {laeuft ? 'Speichern …' : knopf}
            </button>
            {mitHinweisen && <span style={{ minHeight: 15 }} />}
          </div>
        </div>
      </form>
      {status && (
        <div className="card-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <span className={`chip ${status.art === 'ok' ? 'pos' : 'neg'}`}>{status.text}</span>
        </div>
      )}
    </div>
  );
}
