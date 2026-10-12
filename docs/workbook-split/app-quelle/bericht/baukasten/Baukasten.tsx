'use client';

import { useEffect, useState } from 'react';
import { eur0, zahl, num } from '@/lib/format';

type Quelle  = { name: string; bezeichnung: string; beschreibung: string | null; regionsspalte: string | null };
type Spalte  = { spalte: string; typ: string; zahl: boolean };
type Filter  = { spalte: string; op: string; wert: string };
type Rechen  = { name: string; formel: string };
type Vorlage = { id: number; name: string; beschreibung: string | null; quelle: string;
                 aufbau: Aufbau; geaendert_at: string; erstellt_von: string | null };
type Aufbau  = {
  spalten?: string[]; filter?: Filter[]; gruppierung?: string[];
  aggregat?: string; rechenspalten?: Rechen[];
  sortierung?: { spalte: string; richtung: 'auf' | 'ab' } | null; grenze?: number;
};
type Ergebnis = { spalten: { name: string; zahl: boolean }[];
                  zeilen: Record<string, unknown>[]; anzahl: number; sql: string };

const VERGLEICHE: { wert: string; text: string; ohneWert?: boolean }[] = [
  { wert: '=',         text: 'ist gleich' },
  { wert: '<>',        text: 'ist ungleich' },
  { wert: '>',         text: 'größer als' },
  { wert: '>=',        text: 'größer oder gleich' },
  { wert: '<',         text: 'kleiner als' },
  { wert: '<=',        text: 'kleiner oder gleich' },
  { wert: 'enthaelt',  text: 'enthält' },
  { wert: 'beginnt',   text: 'beginnt mit' },
  { wert: 'leer',      text: 'ist leer',        ohneWert: true },
  { wert: 'nichtleer', text: 'ist nicht leer',  ohneWert: true },
];
/**
 * Nicht jede Zahlenspalte ist ein Betrag. Jahreszahlen, Monate,
 * Kalenderwochen und Stückzahlen bekommen kein Eurozeichen und keine
 * Tausendertrennung bei vierstelligen Jahren – sonst steht dort
 * „2.026 €“ statt 2026.
 */
const ZAEHLSPALTEN = new Set([
  'jahr', 'iso_jahr', 'monat', 'kalenderwoche', 'periode', 'position',
  'zeilen', 'anzahl', 'belege', 'belege_sap', 'konten', 'tage',
  'auftraege', 'projekte', 'massnahmen', 'massnahmen_offen',
  'innenauftraege', 'sortierung', 'nl_code', 'bis_monat',
]);
const PROZENTSPALTEN = new Set([
  'fuellgrad', 'erfuellung_prozent', 'sub_quote', 'abweichung_prozent',
  'anteil_im_block', 'wahrscheinlichkeit',
]);

/** Wie ist dieser Wert zu schreiben? */
function darstellen(spalte: string, zahl: boolean, wert: unknown): string {
  if (wert === null || wert === undefined) return '–';
  const name = spalte.toLowerCase();
  if (!zahl) return String(wert);
  if (ZAEHLSPALTEN.has(name)) return String(wert).replace(/\.0+$/, '');
  if (PROZENTSPALTEN.has(name)) {
    const n = num(wert);
    return `${(Math.abs(n) <= 1 ? n * 100 : n).toLocaleString('de-DE',
      { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  }
  return eur0(num(wert));
}

const AGGREGATE = [
  { wert: 'summe',  text: 'Summe' },
  { wert: 'anzahl', text: 'Anzahl' },
  { wert: 'mittel', text: 'Mittelwert' },
  { wert: 'min',    text: 'Minimum' },
  { wert: 'max',    text: 'Maximum' },
];

export default function Baukasten({ quellen, vorlagen }: { quellen: Quelle[]; vorlagen: Vorlage[] }) {
  const [quelle, setQuelle]   = useState(quellen[0]?.name ?? '');
  const [spalten, setSpalten] = useState<Spalte[]>([]);
  const [aufbau, setAufbau]   = useState<Aufbau>({ spalten: [], filter: [], gruppierung: [],
                                                   aggregat: 'summe', rechenspalten: [], grenze: 500 });
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [meldung, setMeldung]   = useState<{ text: string; fehler?: boolean } | null>(null);
  const [laeuft, setLaeuft]     = useState(false);
  const [sqlZeigen, setSqlZeigen] = useState(false);
  const [vorlagenListe, setVorlagenListe] = useState(vorlagen);
  const [name, setName] = useState('');

  const aktuelleQuelle = quellen.find(q => q.name === quelle);

  /* Spalten der gewählten Quelle nachladen. */
  useEffect(() => {
    if (!quelle) return;
    let abgebrochen = false;
    fetch(`/api/baukasten?quelle=${encodeURIComponent(quelle)}`)
      .then(r => r.json())
      .then(d => { if (!abgebrochen) setSpalten(d.spalten ?? []); })
      .catch(() => { if (!abgebrochen) setSpalten([]); });
    return () => { abgebrochen = true; };
  }, [quelle]);

  const setzen = (teil: Partial<Aufbau>) => setAufbau(a => ({ ...a, ...teil }));

  /* Die Daten kommen von selbst.
     Vorher stand die Seite leer da, bis jemand "Anzeigen" fand – und wer die
     Quelle gewechselt hatte, sah weiter die Zeilen der alten. Jede andere
     Seite im Cockpit zeigt ihre Zahlen sofort; diese jetzt auch. */
  useEffect(() => {
    if (!quelle) return;
    const t = setTimeout(() => { void anzeigen(); }, 250);
    return () => clearTimeout(t);
    // anzeigen liest quelle und aufbau aus dem Zustand und braucht deshalb
    // nicht in den Abhaengigkeiten zu stehen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quelle, aufbau]);

  const spalteUmschalten = (s: string) => setAufbau(a => {
    const menge = new Set(a.spalten ?? []);
    menge.has(s) ? menge.delete(s) : menge.add(s);
    return { ...a, spalten: [...menge] };
  });
  const gruppeUmschalten = (s: string) => setAufbau(a => {
    const menge = new Set(a.gruppierung ?? []);
    menge.has(s) ? menge.delete(s) : menge.add(s);
    return { ...a, gruppierung: [...menge] };
  });

  async function anzeigen() {
    setLaeuft(true); setMeldung(null);
    try {
      const r = await fetch('/api/baukasten', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quelle, aufbau }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.fehler || `Fehler ${r.status}`);
      setErgebnis(d);
      setMeldung({ text: `${zahl(d.anzahl)} Zeilen` });
    } catch (e) {
      setErgebnis(null);
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  async function speichern() {
    if (!name.trim()) { setMeldung({ text: 'Bitte einen Namen vergeben.', fehler: true }); return; }
    setLaeuft(true);
    try {
      const r = await fetch('/api/baukasten', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), quelle, aufbau }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.fehler || `Fehler ${r.status}`);
      setMeldung({ text: `Vorlage „${name.trim()}" gespeichert.` });
      setVorlagenListe(l => {
        const ohne = l.filter(v => v.name !== name.trim());
        return [...ohne, { id: d.id, name: name.trim(), beschreibung: null, quelle,
                           aufbau, geaendert_at: new Date().toISOString(),
                           erstellt_von: null }].sort((a, b) => a.name.localeCompare(b.name));
      });
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  function laden(v: Vorlage) {
    setQuelle(v.quelle);
    setAufbau({ spalten: [], filter: [], gruppierung: [], aggregat: 'summe',
                rechenspalten: [], grenze: 500, ...v.aufbau });
    setName(v.name);
    setErgebnis(null);
    setMeldung({ text: `Vorlage „${v.name}" geladen. Auf „Anzeigen" klicken.` });
  }

  async function loeschen(v: Vorlage) {
    setLaeuft(true);
    try {
      const r = await fetch(`/api/baukasten?id=${v.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).fehler || `Fehler ${r.status}`);
      setVorlagenListe(l => l.filter(x => x.id !== v.id));
      setMeldung({ text: `Vorlage „${v.name}" gelöscht.` });
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  /** Als CSV herunterladen – ohne Umweg über den Server. */
  function alsCsv() {
    if (!ergebnis) return;
    const trenne = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const zeilen = [
      ergebnis.spalten.map(s => trenne(s.name)).join(';'),
      ...ergebnis.zeilen.map(z => ergebnis.spalten.map(s => trenne(z[s.name])).join(';')),
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + zeilen], { type: 'text/csv;charset=utf-8' }));
    a.download = `${(name || 'bericht').replace(/[^\wäöüß -]/gi, '')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const gruppiert = !!aufbau.gruppierung?.length;

  return (
    <>
      {meldung && <div className={meldung.fehler ? 'note warn' : 'note'}>{meldung.text}</div>}

      {/* ------------------------------------------------ Datenquelle */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schritt 1</div>
            <h2>Woraus soll gerechnet werden?</h2>
            <p>Jede Quelle ist eine geprüfte Auswertung aus der Datenbank. Es lässt sich
               nichts anderes abfragen – aus dieser Seite geht nie eigenes SQL an den Server.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="form-row form-row--2">
            <div className="form-group">
              <label htmlFor="quelle">Datenquelle</label>
              <select id="quelle" value={quelle} onChange={e => {
                setQuelle(e.target.value);
                setAufbau({ spalten: [], filter: [], gruppierung: [], aggregat: 'summe',
                            rechenspalten: [], grenze: 500 });
                setErgebnis(null);
              }}>
                {quellen.map(q => <option key={q.name} value={q.name}>{q.bezeichnung}</option>)}
              </select>
              {aktuelleQuelle?.beschreibung && (
                <span className="hilfe">{aktuelleQuelle.beschreibung}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="grenze">Höchstens Zeilen</label>
              <input id="grenze" type="number" min={1} max={5000} value={aufbau.grenze ?? 500}
                     onChange={e => setzen({ grenze: Number(e.target.value) })} />
              <span className="hilfe">Schutz vor sehr großen Abfragen, höchstens 5.000.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ Spalten */}
      {!!spalten.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 2</div>
              <h2>Spalten ein- und ausblenden</h2>
              <p>Nichts angehakt heißt: alle Spalten. Beim Gruppieren werden Zahlenspalten
                 zusammengefasst, alles andere fällt weg.</p>
            </div>
          </div>
          <div className="card-body">
            <div className="spaltenwahl">
              {spalten.map(s => (
                <label key={s.spalte} className={`spaltenchip ${aufbau.spalten?.includes(s.spalte) ? 'an' : ''}`}>
                  <input type="checkbox" checked={aufbau.spalten?.includes(s.spalte) ?? false}
                         onChange={() => spalteUmschalten(s.spalte)} />
                  <span>{s.spalte}</span>
                  {s.zahl && <i title="Zahlenspalte">Σ</i>}
                </label>
              ))}
            </div>
            <div className="btn-group" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setzen({ spalten: spalten.map(s => s.spalte) })}>alle</button>
              <button className="btn" onClick={() => setzen({ spalten: [] })}>keine</button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Filter */}
      {!!spalten.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Schritt 3</div><h2>Filtern</h2>
            <p>Mehrere Bedingungen gelten gleichzeitig.</p></div>
          </div>
          <div className="card-body">
            {(aufbau.filter ?? []).map((f, i) => {
              const ohneWert = VERGLEICHE.find(v => v.wert === f.op)?.ohneWert;
              return (
                <div className="form-row form-row--3" key={i}>
                  <div className="form-group">
                    <label>Spalte</label>
                    <select value={f.spalte} onChange={e => setAufbau(a => {
                      const fs = [...(a.filter ?? [])]; fs[i] = { ...fs[i], spalte: e.target.value };
                      return { ...a, filter: fs };
                    })}>
                      {spalten.map(s => <option key={s.spalte} value={s.spalte}>{s.spalte}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Bedingung</label>
                    <select value={f.op} onChange={e => setAufbau(a => {
                      const fs = [...(a.filter ?? [])]; fs[i] = { ...fs[i], op: e.target.value };
                      return { ...a, filter: fs };
                    })}>
                      {VERGLEICHE.map(v => <option key={v.wert} value={v.wert}>{v.text}</option>)}
                    </select>
                  </div>
                  <div className="form-group form-group--actions">
                    {!ohneWert && (
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Wert</label>
                        <input value={f.wert} onChange={e => setAufbau(a => {
                          const fs = [...(a.filter ?? [])]; fs[i] = { ...fs[i], wert: e.target.value };
                          return { ...a, filter: fs };
                        })} />
                      </div>
                    )}
                    <button className="btn" onClick={() => setAufbau(a => ({
                      ...a, filter: (a.filter ?? []).filter((_, j) => j !== i) }))}>entfernen</button>
                  </div>
                </div>
              );
            })}
            <button className="btn" onClick={() => setAufbau(a => ({
              ...a, filter: [...(a.filter ?? []),
                             { spalte: spalten[0].spalte, op: '=', wert: '' }] }))}>
              Bedingung hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Gruppieren */}
      {!!spalten.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Schritt 4</div><h2>Gruppieren und verdichten</h2>
            <p>Nach welchen Merkmalen soll zusammengefasst werden? Die Zahlenspalten werden
               dann mit der gewählten Rechenart verdichtet.</p></div>
          </div>
          <div className="card-body">
            <div className="spaltenwahl">
              {spalten.filter(s => !s.zahl).map(s => (
                <label key={s.spalte} className={`spaltenchip ${aufbau.gruppierung?.includes(s.spalte) ? 'an' : ''}`}>
                  <input type="checkbox" checked={aufbau.gruppierung?.includes(s.spalte) ?? false}
                         onChange={() => gruppeUmschalten(s.spalte)} />
                  <span>{s.spalte}</span>
                </label>
              ))}
            </div>
            {gruppiert && (
              <div className="form-row form-row--2" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label htmlFor="agg">Rechenart für die Zahlenspalten</label>
                  <select id="agg" value={aufbau.aggregat} onChange={e => setzen({ aggregat: e.target.value })}>
                    {AGGREGATE.map(a => <option key={a.wert} value={a.wert}>{a.text}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Rechenspalten */}
      {!!spalten.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Schritt 5</div><h2>Eigene Berechnungen</h2>
            <p>Erlaubt sind Spaltennamen, Zahlen, Klammern und die vier Grundrechenarten –
               etwa <code>umsatz_sap - umsatz_kv</code> oder <code>netto / brutto * 100</code>.
               Durch null wird nicht geteilt; solche Zellen bleiben leer.</p></div>
          </div>
          <div className="card-body">
            {(aufbau.rechenspalten ?? []).map((r, i) => (
              <div className="form-row form-row--2" key={i}>
                <div className="form-group">
                  <label>Name der Spalte</label>
                  <input value={r.name} placeholder="z. B. Abweichung" onChange={e => setAufbau(a => {
                    const rs = [...(a.rechenspalten ?? [])]; rs[i] = { ...rs[i], name: e.target.value };
                    return { ...a, rechenspalten: rs };
                  })} />
                </div>
                <div className="form-group form-group--actions">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Formel</label>
                    <input value={r.formel} placeholder="ist - plan" onChange={e => setAufbau(a => {
                      const rs = [...(a.rechenspalten ?? [])]; rs[i] = { ...rs[i], formel: e.target.value };
                      return { ...a, rechenspalten: rs };
                    })} />
                  </div>
                  <button className="btn" onClick={() => setAufbau(a => ({
                    ...a, rechenspalten: (a.rechenspalten ?? []).filter((_, j) => j !== i) }))}>
                    entfernen
                  </button>
                </div>
              </div>
            ))}
            <button className="btn" onClick={() => setAufbau(a => ({
              ...a, rechenspalten: [...(a.rechenspalten ?? []), { name: '', formel: '' }] }))}>
              Berechnung hinzufügen
            </button>
            <div className="hilfe" style={{ marginTop: 10 }}>
              Verfügbare Spaltennamen: {spalten.filter(s => s.zahl).map(s => s.spalte).join(', ') || '–'}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Ausführen */}
      <div className="card">
        <div className="card-body filterleiste">
          <button className="btn primary" onClick={anzeigen} disabled={laeuft || !quelle}>
            {laeuft ? 'rechnet …' : 'Anzeigen'}
          </button>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="vname">Als Vorlage speichern unter</label>
            <input id="vname" value={name} placeholder="z. B. Abweichung KV je Region"
                   onChange={e => setName(e.target.value)} />
          </div>
          <button className="btn" onClick={speichern} disabled={laeuft || !name.trim()}>Speichern</button>
          <button className="btn" onClick={alsCsv} disabled={!ergebnis}>Als CSV</button>
          <label className="toggle-check">
            <input type="checkbox" checked={sqlZeigen} onChange={e => setSqlZeigen(e.target.checked)} />
            <span>Abfrage zeigen</span>
          </label>
        </div>
        {sqlZeigen && ergebnis && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <pre className="sqlanzeige">{ergebnis.sql}</pre>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ Ergebnis */}
      {ergebnis && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Ergebnis</div>
            <h2>{zahl(ergebnis.anzahl)} Zeilen</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr>{ergebnis.spalten.map(s => (
                    <th key={s.name} className={s.zahl ? 'r' : undefined}>{s.name}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {ergebnis.zeilen.map((z, i) => (
                    <tr key={i}>
                      {ergebnis.spalten.map(s => (
                        <td key={s.name} className={s.zahl ? 'r num' : undefined}>
                          {darstellen(s.name, s.zahl, z[s.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!ergebnis.zeilen.length && (
                    <tr><td colSpan={ergebnis.spalten.length}>
                      <div className="empty">Keine Zeile passt zu den Bedingungen.</div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Vorlagen */}
      {!!vorlagenListe.length && (
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Gespeichert</div><h2>Vorlagen</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Name</th><th>Datenquelle</th><th>Geändert</th><th>Von</th><th /></tr></thead>
                <tbody>
                  {vorlagenListe.map(v => (
                    <tr key={v.id}>
                      <td><b>{v.name}</b></td>
                      <td className="muted">
                        {quellen.find(q => q.name === v.quelle)?.bezeichnung ?? v.quelle}
                      </td>
                      <td className="muted">{String(v.geaendert_at).slice(0, 10)}</td>
                      <td className="muted">{v.erstellt_von ?? '–'}</td>
                      <td className="r">
                        <div className="btn-group">
                          <button className="btn klein" onClick={() => laden(v)}>laden</button>
                          <button className="btn klein" onClick={() => loeschen(v)}>löschen</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
