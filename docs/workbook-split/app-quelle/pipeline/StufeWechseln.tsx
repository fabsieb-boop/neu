'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STUFEN = ['LEAD', 'QUALIFIZIERT', 'ANGEBOT', 'VERHANDLUNG', 'GEWONNEN', 'VERLOREN'];

/** Stufe einer Chance direkt in der Zeile weiterschalten. */
export default function StufeWechseln({ chanceId, stufe, wahrscheinlichkeit, kunde, bezeichnung }: {
  chanceId: number; stufe: string; wahrscheinlichkeit: number; kunde: string; bezeichnung: string;
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);

  async function wechseln(neu: string) {
    setLaeuft(true);
    try {
      await fetch('/api/planung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modul: 'chance', chance_id: chanceId, stufe: neu, kunde, bezeichnung,
          // Gewonnen und Verloren sind entschieden – die Gewichtung folgt der Entscheidung
          wahrscheinlichkeit: neu === 'GEWONNEN' ? 1 : neu === 'VERLOREN' ? 0 : wahrscheinlichkeit,
        }),
      });
      router.refresh();
    } finally { setLaeuft(false); }
  }

  return (
    <select value={stufe} disabled={laeuft} aria-label={`Stufe von ${kunde}`}
            onChange={e => wechseln(e.target.value)} style={{ minWidth: 130 }}>
      {STUFEN.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
    </select>
  );
}
