'use client';

import { useState } from 'react';

/* ---------------------------------------------------------------------------
   Welche Monate gerechnet werden
   ---------------------------------------------------------------------------
   Ein Häkchen je Monat, mehr nicht.  Gesetzt heisst: dieser Monat zählt in
   jede Auswertung.  Nicht gesetzt heisst: er bleibt stehen, wird aber
   schraffiert gezeigt und in keiner Summe mitgerechnet.

   Daneben steht die Belegdichte – nicht als Entscheidung, sondern als
   Hinweis.  Ein Monat mit 39 Prozent der üblichen Belege ist selten fertig,
   aber das zu beurteilen ist nicht Sache der Datenbank.

   „Auf Datenlage zurücksetzen“ nimmt alle Häkchen zurück; dann entscheidet
   wieder die Belegdichte allein, so wie vor dieser Einstellung.
--------------------------------------------------------------------------- */

export type Periode = {
  monat: number; belege: number; fuellgrad: number;
  belastbar: boolean; freigabe: boolean | null; belastbar_effektiv: boolean;
};

const MONATE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default function Monatsfreigabe({ jahr, perioden }: {
  jahr: number; perioden: Periode[];
}) {
  const [stand, setStand] = useState<Periode[]>(
    [...perioden].sort((a, b) => a.monat - b.monat));
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  /* Gerechnet wird bis zum letzten Monat einer ununterbrochenen Reihe –
     ein Loch im Mai macht den Juni nicht belastbar. */
  const bis = (() => {
    let n = 0;
    for (const p of stand) { if (!p.belastbar_effektiv) break; n = p.monat; }
    return n;
  })();

  function haken(monat: number, an: boolean) {
    setStand(s => s.map(p => p.monat === monat
      ? { ...p, freigabe: an, belastbar_effektiv: an } : p));
    setMeldung(null);
  }

  async function senden(monate: { monat: number; freigegeben: boolean | null }[],
                        text: string) {
    setLaeuft(true);
    try {
      const r = await fetch('/api/einstellungen/monate', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jahr, monate }),
      });
      const j = await r.json();
      if (!r.ok) { setMeldung(j?.fehler ?? 'Speichern fehlgeschlagen'); return; }
      setStand([...j.monate].sort((a: Periode, b: Periode) => a.monat - b.monat));
      setMeldung(`${text} Gerechnet wird bis ${MONATE[j.bis] || '–'}.`);
    } finally {
      setLaeuft(false);
    }
  }

  const speichern = () => senden(
    stand.map(p => ({ monat: p.monat, freigegeben: p.belastbar_effektiv })),
    'Gespeichert.');
  const zuruecksetzen = () => senden(
    stand.map(p => ({ monat: p.monat, freigegeben: null })),
    'Zurückgesetzt.');

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Geschäftsjahr {jahr}</div>
          <h2>Welche Monate gerechnet werden</h2>
        </div>
        <span className="chip info">bis {MONATE[bis] || '–'}</span>
      </div>

      <div className="card-body flush">
        <div className="tablewrap">
          <table className="data compact">
            <thead>
              <tr>
                <th style={{ width: '3rem' }}>Rechnen</th>
                <th>Monat</th>
                <th className="r">Belege</th>
                <th className="r">Füllgrad</th>
              </tr>
            </thead>
            <tbody>
              {stand.map(p => (
                <tr key={p.monat} className={p.belastbar_effektiv ? '' : 'schraffiert'}>
                  <td>
                    <input type="checkbox" checked={p.belastbar_effektiv}
                           aria-label={`${MONATE[p.monat]} mitrechnen`}
                           onChange={e => haken(p.monat, e.target.checked)} />
                  </td>
                  <td><b>{MONATE[p.monat]}</b></td>
                  <td className="r num muted">{p.belege?.toLocaleString('de-DE')}</td>
                  <td className={`r num ${p.fuellgrad >= 70 ? '' : 'neg'}`}>
                    {p.fuellgrad} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-body">
        <div className="toolbar-aktionen">
          <button className="btn primary" type="button" disabled={laeuft}
                  onClick={speichern}>
            {laeuft ? 'speichert …' : 'Speichern'}
          </button>
          <button className="btn" type="button" disabled={laeuft}
                  onClick={zuruecksetzen}>
            Auf Datenlage zurücksetzen
          </button>
          {meldung && <span className="chip info">{meldung}</span>}
        </div>
      </div>
    </div>
  );
}
