'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Projekt = { id: number; nr: string; name: string };

const LEER = {
  projekt_id: '', kategorie: '', beschreibung: '',
  wahrscheinlichkeit: 3, auswirkung: 3, entdeckbarkeit: 3,
  massnahme: '', verantwortlicher: '', frist: '', status: 'OFFEN',
};

export default function RisikoForm({ projekte }: { projekte: Projekt[] }) {
  const router = useRouter();
  const [f, setF] = useState({ ...LEER });
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const rpz = f.wahrscheinlichkeit * f.auswirkung * f.entdeckbarkeit;
  const setzen = (k: string, v: string | number) => setF(x => ({ ...x, [k]: v }));

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!f.beschreibung.trim()) { setStatus({ art: 'fehler', text: 'Bitte eine Beschreibung erfassen.' }); return; }
    setLaeuft(true); setStatus(null);
    try {
      const r = await fetch('/api/risks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, projekt_id: f.projekt_id ? Number(f.projekt_id) : null, frist: f.frist || null }),
      });
      if (r.ok) { setF({ ...LEER }); setStatus({ art: 'ok', text: 'Risiko erfasst.' }); router.refresh(); }
      else {
        const d = await r.json().catch(() => ({}));
        setStatus({ art: 'fehler', text: d.error === 'FORBIDDEN'
          ? 'Keine Berechtigung zum Erfassen von Risiken.' : 'Speichern fehlgeschlagen.' });
      }
    } catch { setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' }); }
    finally { setLaeuft(false); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Erfassung</div>
          <h2>Risiko aufnehmen</h2>
          <p>Bewertung jeweils 1 (unkritisch) bis 5 (kritisch).</p>
        </div>
        <span className={`chip ${rpz >= 60 ? 'neg' : rpz >= 30 ? 'warn' : 'info'}`}>RPZ {rpz}</span>
      </div>
      <form onSubmit={speichern}>
        <div className="toolbar">
          <div className="field" style={{ flex: 2, minWidth: 260 }}>
            <label>Beschreibung</label>
            <input value={f.beschreibung} onChange={e => setzen('beschreibung', e.target.value)}
                   placeholder="Worin besteht das Risiko?" style={{ width: '100%' }} />
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Projekt</label>
            <select value={f.projekt_id} onChange={e => setzen('projekt_id', e.target.value)}>
              <option value="">übergreifend</option>
              {projekte.map(p => <option key={p.id} value={p.id}>{p.nr} – {p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Kategorie</label>
            <input value={f.kategorie} onChange={e => setzen('kategorie', e.target.value)} placeholder="z. B. Termin" />
          </div>
          {([['wahrscheinlichkeit', 'Wahrsch.'], ['auswirkung', 'Auswirkung'], ['entdeckbarkeit', 'Entdeckbark.']] as const)
            .map(([k, l]) => (
              <div className="field" key={k} style={{ minWidth: 90 }}>
                <label>{l}</label>
                <select value={(f as any)[k]} onChange={e => setzen(k, Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
          <div className="field" style={{ minWidth: 200 }}>
            <label>Maßnahme</label>
            <input value={f.massnahme} onChange={e => setzen('massnahme', e.target.value)} />
          </div>
          <div className="field">
            <label>Verantwortlich</label>
            <input value={f.verantwortlicher} onChange={e => setzen('verantwortlicher', e.target.value)} />
          </div>
          <div className="field">
            <label>Frist</label>
            <input type="date" value={f.frist} onChange={e => setzen('frist', e.target.value)} />
          </div>
          <button className="btn primary" type="submit" disabled={laeuft}>
            {laeuft ? 'Speichern …' : 'Risiko speichern'}
          </button>
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
