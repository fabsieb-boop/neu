'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Kalkulation anlegen, berichtigen oder als neue Fassung fortschreiben.
 *
 * Der Unterschied ist der Punkt: ein Vertipper ist keine neue Fassung.
 * Wird "Berichtigen" gewaehlt, aendert sich die bestehende Kalkulation –
 * ohne Version, ohne dass eine falsche Zahl als "ersetzt" stehen bleibt.
 * "Als neue Fassung" ist die andere Sache: die Kalkulation hat sich
 * geaendert, die alte bleibt zum Nachlesen.
 *
 * Betraege lassen sich nur bei der kurzen Form aendern.  Kommt die
 * Kalkulation aus einer hochgeladenen Tabelle, waere es falsch, die Summe
 * zu verstellen und die Positionen stehen zu lassen – dann sind hier nur
 * die Kopfangaben aenderbar.
 */

type Vorhanden = {
  kalkulation_id: number; version: number; bezeichnung: string;
  stand: string; erloes: number; kosten: number; positionen: number;
  notiz: string | null;
};

const zahlFeld = (v: number) =>
  v ? String(Math.round(v * 100) / 100).replace('.', ',') : '';

export default function KalkulationPflegen({ projektNr, vorhanden }: {
  projektNr: string;
  vorhanden: Vorhanden | null;
}) {
  const router = useRouter();
  const kurzform = !vorhanden || vorhanden.positionen <= 2;

  const [bezeichnung, setBezeichnung] = useState(vorhanden?.bezeichnung ?? 'Urkalkulation');
  const [erloes, setErloes] = useState(vorhanden ? zahlFeld(vorhanden.erloes) : '');
  const [kosten, setKosten] = useState(vorhanden ? zahlFeld(vorhanden.kosten) : '');
  const [stand, setStand] = useState(vorhanden?.stand ?? '');
  const [notiz, setNotiz] = useState(vorhanden?.notiz ?? '');
  const [laeuft, setLaeuft] = useState<null | 'aendern' | 'neu' | 'loeschen'>(null);
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  const FEHLERTEXT: Record<string, string> = {
    PROJEKTNUMMER_FEHLT: 'Die Projektnummer fehlt.',
    PROJEKT_UNBEKANNT: 'Dieses Projekt gibt es nicht.',
    KALKULATION_LEER: 'Bitte Auftragssumme oder Plankosten angeben.',
    KALKULATION_UNBEKANNT: 'Diese Kalkulation gibt es nicht mehr.',
    FORBIDDEN: 'Ihrer Rolle fehlt das Recht projects.write.',
  };

  async function senden(was: 'aendern' | 'neu') {
    setLaeuft(was); setStatus(null);
    try {
      const r = await fetch('/api/planung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modul: 'kalkulation', projekt_nr: projektNr,
          ...(was === 'aendern' && vorhanden ? { kalkulation_id: vorhanden.kalkulation_id } : {}),
          bezeichnung, erloes, kosten, stand, notiz,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setStatus({ art: 'fehler', text: FEHLERTEXT[d.error] ?? d.error }); return; }
      setStatus({ art: 'ok', text: was === 'aendern'
        ? 'Kalkulation berichtigt.' : 'Neue Fassung gespeichert.' });
      router.refresh();
    } catch {
      setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' });
    } finally { setLaeuft(null); }
  }

  async function loeschen() {
    if (!vorhanden) return;
    setLaeuft('loeschen'); setStatus(null);
    try {
      const r = await fetch(
        `/api/planung?modul=kalkulation&id=${vorhanden.kalkulation_id}`, { method: 'DELETE' });
      if (!r.ok) { setStatus({ art: 'fehler', text: 'Löschen fehlgeschlagen.' }); return; }
      setStatus({ art: 'ok', text: 'Kalkulation gelöscht.' });
      router.refresh();
    } catch {
      setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' });
    } finally { setLaeuft(null); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">Erfassung</div>
          <h2>{vorhanden ? 'Kalkulation berichtigen oder fortschreiben' : 'Kalkulation hinterlegen'}</h2>
          <p>
            {vorhanden
              ? kurzform
                ? 'Ein Vertipper ist keine neue Fassung — berichtigen ändert die bestehende. '
                  + 'Hat sich die Kalkulation wirklich geändert, wird eine neue Fassung daraus; '
                  + 'die alte bleibt zum Nachlesen.'
                : 'Diese Kalkulation kommt aus einer hochgeladenen Tabelle. Berichtigt werden '
                  + 'hier nur Bezeichnung, Stand und Notiz — die Beträge stehen in den Positionen '
                  + 'und kommen über einen neuen Import.'
              : 'Die kurze Form: Auftragssumme und Plankosten. Die vollständige Kalkulation mit '
                + 'Positionen kommt über den Datenimport.'}
          </p>
        </div>
        {vorhanden && <span className="chip info">Fassung {vorhanden.version}</span>}
      </div>

      <div className="toolbar">
        <div className="field" style={{ minWidth: 190, flex: 1 }}>
          <label htmlFor="kalk-bez">Bezeichnung</label>
          <input id="kalk-bez" value={bezeichnung} style={{ width: '100%' }}
                 onChange={e => setBezeichnung(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="kalk-erloes">Auftragssumme €</label>
          <input id="kalk-erloes" value={erloes} disabled={!kurzform} inputMode="decimal"
                 onChange={e => setErloes(e.target.value.replace(/[^0-9,.\-]/g, ''))} />
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="kalk-kosten">Plankosten €</label>
          <input id="kalk-kosten" value={kosten} disabled={!kurzform} inputMode="decimal"
                 onChange={e => setKosten(e.target.value.replace(/[^0-9,.\-]/g, ''))} />
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="kalk-stand">Stand</label>
          <input id="kalk-stand" type="date" value={stand}
                 onChange={e => setStand(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 190, flex: 1 }}>
          <label htmlFor="kalk-notiz">Notiz</label>
          <input id="kalk-notiz" value={notiz} style={{ width: '100%' }}
                 onChange={e => setNotiz(e.target.value)} />
        </div>
        <div className="field">
          <label aria-hidden="true">&nbsp;</label>
          <div className="btn-group">
            {vorhanden && (
              <button className="btn primary" disabled={!!laeuft} onClick={() => senden('aendern')}>
                {laeuft === 'aendern' ? 'Wird berichtigt …' : 'Berichtigen'}
              </button>
            )}
            <button className={`btn ${vorhanden ? '' : 'primary'}`} disabled={!!laeuft}
                    onClick={() => senden('neu')}>
              {laeuft === 'neu' ? 'Wird gespeichert …'
                : vorhanden ? 'Als neue Fassung' : 'Kalkulation speichern'}
            </button>
          </div>
        </div>
      </div>

      {(status || vorhanden) && (
        <div className="card-body" style={{ paddingTop: 12, paddingBottom: 12,
                                            display: 'flex', gap: 12, alignItems: 'center' }}>
          {status && <span className={`chip ${status.art === 'ok' ? 'pos' : 'neg'}`}>{status.text}</span>}
          {vorhanden && (
            <button className="btn klein" disabled={!!laeuft} onClick={loeschen}
                    title="Entfernt diese Fassung samt Positionen">
              {laeuft === 'loeschen' ? 'Wird gelöscht …' : 'Diese Fassung löschen'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
