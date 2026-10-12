'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Aus einer gewonnenen Chance ein Projekt machen.
 *
 * Der Weg, den der Vertrieb ohnehin geht: Angebot, Zuschlag, Auftragsnummer.
 * Bisher endete er im Cockpit bei „Gewonnen“ – das Projekt musste jemand
 * anders anlegen, und bis dahin liefen die ersten Buchungen ins Leere.
 *
 * Uebernommen werden Kunde, Vorhaben, Region und Auftragswert aus der
 * Chance; einzugeben ist nur die Auftragsnummer.  Danach ist die Chance mit
 * dem Projekt verbunden.
 */
export default function ProjektAusChance({ chance }: {
  chance: {
    chance_id: number; kunde: string; bezeichnung: string;
    regionscode: string | null; umsatz: number; erwarteter_start: string | null;
  };
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [nr, setNr] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');

  const FEHLERTEXT: Record<string, string> = {
    PROJEKTNUMMER_FEHLT: 'Bitte die Auftragsnummer angeben.',
    PROJEKT_EXISTIERT: 'Diese Auftragsnummer gibt es schon.',
    BEZEICHNUNG_FEHLT: 'Der Chance fehlt eine Bezeichnung.',
    FORBIDDEN: 'Ihrer Rolle fehlt das Recht projects.write.',
  };

  async function anlegen() {
    setLaeuft(true); setFehler('');
    try {
      const r = await fetch('/api/planung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modul: 'projekt', chance_id: chance.chance_id,
          projekt_nr: nr.trim().toUpperCase(),
          projektname: chance.bezeichnung,
          regionscode: chance.regionscode ?? '',
          startdatum: chance.erwarteter_start ?? '',
          budget_umsatz: chance.umsatz,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setFehler(FEHLERTEXT[d.error] ?? d.detail ?? d.error ?? 'Fehlgeschlagen.'); return; }
      setOffen(false); setNr('');
      router.refresh();
    } catch {
      setFehler('Der Server ist nicht erreichbar.');
    } finally { setLaeuft(false); }
  }

  if (!offen)
    return (
      <button className="btn klein" onClick={() => setOffen(true)}>
        Projekt anlegen
      </button>
    );

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={nr} autoFocus placeholder="P4102…" style={{ width: 130 }}
             aria-label={`Auftragsnummer für ${chance.bezeichnung}`}
             onChange={e => setNr(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter' && nr.trim()) anlegen(); }} />
      <button className="btn klein primary" disabled={laeuft || !nr.trim()} onClick={anlegen}>
        {laeuft ? 'legt an …' : 'Anlegen'}
      </button>
      <button className="btn klein" disabled={laeuft} onClick={() => { setOffen(false); setFehler(''); }}>
        Abbrechen
      </button>
      {fehler && <span className="chip neg">{fehler}</span>}
    </span>
  );
}
