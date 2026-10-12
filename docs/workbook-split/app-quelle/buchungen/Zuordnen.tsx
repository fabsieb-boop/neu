'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState } from 'react';

export type ProjektWahl = { projekt_nr: string; projektname: string };

const Stamm = createContext<ProjektWahl[]>([]);

export function StammListe({ projekte, children }: { projekte: ProjektWahl[]; children: React.ReactNode }) {
  return <Stamm.Provider value={projekte}>{children}</Stamm.Provider>;
}

/**
 * Auftrag einer einzelnen Primärbuchung zuordnen.
 * Speichern legt einen Beleg KORR an, das SAP-Original bleibt stehen.
 */
export default function Zuordnen({
  buchungId, wert, konto, text, auftrag, vorschlag,
}: {
  buchungId: number;
  wert: number;
  konto: string;
  text: string;
  auftrag: string;
  vorschlag: string;
}) {
  const projekte = useContext(Stamm);
  const router = useRouter();
  const [ziel, setZiel] = useState(vorschlag || auftrag);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const name = projekte.find(p => p.projekt_nr === ziel)?.projektname;

  async function speichern() {
    setLaeuft(true);
    setMeldung('');
    try {
      const antwort = await fetch('/api/admin/buchung', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buchung_id: buchungId,
          wert,
          konto,
          auftrag: ziel,
          buchungstext: text,
        }),
      });
      const daten = await antwort.json().catch(() => ({}));
      setFehler(!antwort.ok);
      setMeldung(daten.hinweis || daten.fehler || 'Speichern fehlgeschlagen.');
      if (antwort.ok) router.refresh();
    } catch {
      setFehler(true);
      setMeldung('Speichern ist nicht erreichbar.');
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="zuordnen">
      <input
        list="auftragStamm"
        value={ziel}
        aria-label="Auftrag"
        placeholder="Auftrag"
        onChange={e => setZiel(e.target.value)}
      />
      {name && <span className="muted">{name}</span>}
      {vorschlag && ziel !== vorschlag && (
        <button type="button" className="btn klein" onClick={() => setZiel(vorschlag)}>
          {vorschlag} übernehmen
        </button>
      )}
      <button type="button" className="btn primary klein" disabled={laeuft || !ziel.trim()} onClick={speichern}>
        {laeuft ? 'Speichert …' : 'Zuordnen'}
      </button>
      {meldung && <span className={fehler ? 'zuordnen-fehler' : 'muted'}>{meldung}</span>}
    </div>
  );
}
