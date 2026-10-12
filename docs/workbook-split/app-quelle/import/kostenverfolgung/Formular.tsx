'use client';

import { useState } from 'react';

/* Vorschau zuerst, schreiben danach – der Stapel wird gezeigt, bevor er
   ankommt.  Gelesen wird im Browser nur die Datei, geprüft wird am Server. */

type Zeile = {
  datei: string; psp: string | null; projekttitel: string | null; region: string | null;
  werte: number; umsatz: number | null; kosten: number | null; ergebnis: number | null;
};
type Antwort = {
  schritt?: string; gelesen?: number; uebernommen?: number;
  uebersprungen?: { datei: string; grund: string }[]; vorschau?: Zeile[];
  error?: string; detail?: string;
};

const eur = (v: number | null) =>
  v === null ? '–' : v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';

export default function Formular() {
  const [dateien, setDateien] = useState<File[]>([]);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);

  async function senden(schritt: 'vorschau' | 'import') {
    if (!dateien.length) return;
    setLaeuft(true);
    try {
      const nutzlast = await Promise.all(dateien.map(async d => ({
        dateiname: d.name,
        geaendert: d.lastModified,
        inhalt: btoa(String.fromCharCode(
          ...new Uint8Array(await d.arrayBuffer()))),
      })));
      const r = await fetch('/api/import/kostenverfolgung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schritt, dateien: nutzlast }),
      });
      const j: Antwort = await r.json();
      setAntwort(j);
      setFertig(schritt === 'import' && !j.error);
    } catch (e) {
      setAntwort({ error: 'LESEN_FEHLGESCHLAGEN',
                   detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setLaeuft(false);
    }
  }

  const summe = (f: (z: Zeile) => number | null) =>
    (antwort?.vorschau ?? []).reduce((a, z) => a + (f(z) ?? 0), 0);

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Übersichtsblatt je Projekt</div>
            <h2>Kostenverfolgungen einlesen</h2>
          </div>
          {!!dateien.length && <span className="chip info">{dateien.length} Dateien</span>}
        </div>
        <div className="card-body">
          <div className="field feld-breit">
            <label htmlFor="mappen">Excel-Mappen</label>
            <input id="mappen" type="file" multiple accept=".xlsx,.xlsm"
                   onChange={e => {
                     setDateien(Array.from(e.target.files ?? []));
                     setAntwort(null); setFertig(false);
                   }} />
          </div>
          <div className="toolbar-aktionen" style={{ marginTop: '.75rem' }}>
            <button className="btn" type="button" disabled={!dateien.length || laeuft}
                    onClick={() => senden('vorschau')}>
              {laeuft ? 'liest …' : 'Lesen und zeigen'}
            </button>
            <button className="btn primary" type="button"
                    disabled={!antwort?.vorschau?.length || laeuft || fertig}
                    onClick={() => senden('import')}>
              Übernehmen
            </button>
          </div>
        </div>
      </div>

      {antwort?.error && (
        <div className="note bad">
          <b>{antwort.error}</b>{antwort.detail ? ` – ${antwort.detail}` : ''}
        </div>
      )}

      {fertig && (
        <div className="note good">
          <b>{antwort?.uebernommen} Kostenverfolgungen übernommen.</b>
        </div>
      )}

      {!!antwort?.uebersprungen?.length && (
        <div className="note warn">
          <b>{antwort.uebersprungen.length} Dateien übersprungen.</b>
          {antwort.uebersprungen.map(u => (
            <span className="zeile" key={u.datei + u.grund}>{u.datei} – {u.grund}</span>
          ))}
        </div>
      )}

      {!!antwort?.vorschau?.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">{fertig ? 'Übernommen' : 'Vorschau'}</div>
              <h2>{antwort.vorschau.length} Projekte</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>PSP</th><th>Projekt</th><th>Region</th>
                      <th className="r">Umsatz</th><th className="r">Kosten</th>
                      <th className="r">Ergebnis</th><th className="r">Werte</th>
                      <th>Datei</th></tr>
                </thead>
                <tbody>
                  {antwort.vorschau.map(z => (
                    <tr key={z.datei}>
                      <td className="mono">{z.psp}</td>
                      <td>{z.projekttitel ?? '–'}</td>
                      <td className="muted">{z.region ?? '–'}</td>
                      <td className="r num">{eur(z.umsatz)}</td>
                      <td className="r num">{eur(z.kosten)}</td>
                      <td className="r num"><b>{eur(z.ergebnis)}</b></td>
                      <td className="r num muted">{z.werte}</td>
                      <td className="muted">{z.datei}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th colSpan={3}>Summe</th>
                      <th className="r num">{eur(summe(z => z.umsatz))}</th>
                      <th className="r num">{eur(summe(z => z.kosten))}</th>
                      <th className="r num">{eur(summe(z => z.ergebnis))}</th>
                      <th colSpan={2}></th></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
