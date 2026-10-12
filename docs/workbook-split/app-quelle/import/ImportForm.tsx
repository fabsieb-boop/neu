'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dateiart, Zielfeld } from '@/lib/importarten';

/**
 * Maske fuer den Datenimport.
 *
 * Die Reihenfolge ist der Punkt: erst sagen, **was die Datei ist**, dann
 * zuordnen, dann pruefen, dann schreiben.  Vorher hat der Importer ein
 * einziges Format gekannt und alles andere abgelehnt.
 *
 * Kein Feld haelt den Import auf.  Fehlt etwas, bleibt die betroffene Zeile
 * liegen und steht mit Grund im Bericht – der Knopf bleibt erreichbar.
 */

type Kennzahl = { label: string; wert: string; hinweis?: string };

type Antwort = {
  ok?: boolean; error?: string; detail?: string;
  schritt?: 'analyse' | 'testlauf' | 'import';
  dateiname?: string; format?: 'csv' | 'excel'; trennzeichen?: string;
  blaetter?: string[]; blatt?: string; kopfzeile?: number;
  kopf?: string[]; vorschau?: string[][];
  art?: string; art_vorschlag?: string;
  arten?: Dateiart[]; felder?: Zielfeld[];
  zuordnung?: Record<string, number>; festwerte?: Record<string, string>;
  zugeordnete_spalten?: number; spalten_gesamt?: number;
  kennzahlen?: Kennzahl[];
  zeilen_gelesen?: number; zeilen_importierbar?: number;
  zeilen_zusatz?: number; zeilen_uebersprungen?: number;
  summe_wert?: number; importiert?: number; import_id?: number;
  nichts_zu_tun?: boolean; nur_ansehen?: boolean; eigener_leser?: boolean;
  unbekannte_auftraege?: string[]; unbekannte_auftraege_anzahl?: number;
  unbekannte_konten?: string[]; unbekannte_konten_anzahl?: number;
  hinweise?: { zeile: number; grund: string }[];
  vorschau_saetze?: Record<string, unknown>[];
};

const zahlF = (v: unknown) => new Intl.NumberFormat('de-DE').format(Number(v) || 0);

/** Merkzettel fuer Zuordnungen – je Art und Spaltenkopf. */
const merkschluessel = (art: string, kopf: string[]) =>
  `import:${art}:${kopf.join('|').slice(0, 300)}`;

export default function ImportForm() {
  const router = useRouter();

  const [datei, setDatei] = useState<File | null>(null);
  const [inhalt, setInhalt] = useState('');
  const [binaer, setBinaer] = useState(false);
  const [analyse, setAnalyse] = useState<Antwort | null>(null);
  const [bericht, setBericht] = useState<Antwort | null>(null);
  const [art, setArt] = useState('');
  const [zuordnung, setZuordnung] = useState<Record<string, number>>({});
  const [festwerte, setFestwerte] = useState<Record<string, string>>({});
  const [ausrichtung, setAusrichtung] = useState<'datei' | 'kosten' | 'erloese'>('datei');
  const [quelle, setQuelle] = useState('Kostenverfolgung');
  const [merken, setMerken] = useState(true);
  const [projekteAnlegen, setProjekteAnlegen] = useState(false);
  const [nurJahr, setNurJahr] = useState(String(new Date().getFullYear()));
  const [laeuft, setLaeuft] = useState<null | 'analyse' | 'testlauf' | 'import'>(null);

  const arten = analyse?.arten ?? [];
  const felder = analyse?.felder ?? [];
  const kopf = analyse?.kopf ?? [];
  const aktuelleArt = arten.find(a => a.key === art);
  const fehler = bericht?.error ?? analyse?.error;

  /* ---------------------------------------------------------------- */

  async function anfragen(zusatz: Record<string, unknown>): Promise<Antwort> {
    const r = await fetch('/api/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateiname: datei?.name ?? 'import.csv', inhalt, binaer,
        blatt: analyse?.blatt, kopfzeile: analyse?.kopfzeile,
        ausrichtung, quelle, projekteAnlegen, nurJahr, ...zusatz,
      }),
    });
    return r.json();
  }

  /** Datei einlesen und die Art vorschlagen lassen. */
  async function waehlen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setDatei(f); setAnalyse(null); setBericht(null);
    setZuordnung({}); setFestwerte({}); setArt(''); setInhalt('');
    if (!f) return;

    const istExcel = /\.(xlsx|xlsm|xlsb|xls)$/i.test(f.name);
    setBinaer(istExcel);
    let text: string;
    if (istExcel) {
      const puffer = new Uint8Array(await f.arrayBuffer());
      let s = '';
      for (let i = 0; i < puffer.length; i += 8192)
        s += String.fromCharCode(...puffer.subarray(i, i + 8192));
      text = btoa(s);
    } else {
      text = await f.text();
    }
    setInhalt(text);

    setLaeuft('analyse');
    try {
      const r = await fetch('/api/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateiname: f.name, inhalt: text, binaer: istExcel, schritt: 'analyse' }),
      });
      const d: Antwort = await r.json();
      setAnalyse(d);
      if (d.error) { setBericht(d); return; }
      const gewaehlt = d.art_vorschlag ?? 'pruefen';
      setArt(gewaehlt);
      uebernehmen(d, gewaehlt);
    } catch {
      setBericht({ error: 'NETZWERKFEHLER' });
    } finally { setLaeuft(null); }
  }

  /** Gemerkte Zuordnung einsetzen, sonst die automatisch erkannte. */
  function uebernehmen(d: Antwort, artKey: string) {
    const gemerkt = typeof window !== 'undefined'
      ? window.localStorage.getItem(merkschluessel(artKey, d.kopf ?? [])) : null;
    if (gemerkt) {
      try {
        const g = JSON.parse(gemerkt) as { zuordnung: Record<string, number>; festwerte: Record<string, string> };
        setZuordnung(g.zuordnung ?? {}); setFestwerte(g.festwerte ?? {});
        return;
      } catch { /* unbrauchbar gemerkt – weiter mit der Automatik */ }
    }
    setZuordnung(d.zuordnung ?? {}); setFestwerte({});
  }

  /** Art wechseln: neue Felder holen, Zuordnung neu vorschlagen. */
  async function artWechseln(neu: string) {
    setArt(neu); setBericht(null);
    setLaeuft('analyse');
    try {
      const d = await anfragen({ schritt: 'analyse', art: neu });
      if (d.error) { setBericht(d); return; }
      setAnalyse(a => ({ ...(a ?? {}), ...d }));
      uebernehmen(d, neu);
    } finally { setLaeuft(null); }
  }

  /** Blatt oder Kopfzeile umstellen – die Datei wird neu zerlegt. */
  async function neuLesen(feld: 'blatt' | 'kopfzeile', wert: string | number) {
    setLaeuft('analyse'); setBericht(null);
    try {
      const d = await anfragen({ schritt: 'analyse', art, [feld]: wert,
                                 ...(feld === 'blatt' ? { kopfzeile: undefined } : {}) });
      if (d.error) { setBericht(d); return; }
      setAnalyse(a => ({ ...(a ?? {}), ...d }));
      setZuordnung(d.zuordnung ?? {});
    } finally { setLaeuft(null); }
  }

  async function senden(schritt: 'testlauf' | 'import') {
    setLaeuft(schritt);
    try {
      const d = await anfragen({ schritt, art, zuordnung, festwerte });
      setBericht(d);
      if (schritt === 'import' && d.ok) {
        if (merken && typeof window !== 'undefined')
          window.localStorage.setItem(merkschluessel(art, kopf),
            JSON.stringify({ zuordnung, festwerte }));
        router.refresh();
      }
    } catch {
      setBericht({ error: 'NETZWERKFEHLER' });
    } finally { setLaeuft(null); }
  }

  const setzeZuordnung = (feld: string, wert: string) =>
    setZuordnung(z => {
      const neu = { ...z };
      if (wert === '') delete neu[feld];
      else {
        const idx = Number(wert);
        for (const k of Object.keys(neu)) if (neu[k] === idx) delete neu[k];   // Spalte nur einmal
        neu[feld] = idx;
      }
      return neu;
    });

  const setzeFest = (feld: string, wert: string) =>
    setFestwerte(f => { const n = { ...f }; if (wert.trim()) n[feld] = wert; else delete n[feld]; return n; });

  const offen = felder.filter(z =>
    z.schluessel && zuordnung[z.feld] === undefined && !(festwerte[z.feld] ?? '').trim());

  return (
    <>
      {/* ------------------------------------------------ Schritt 1: Datei */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schritt 1</div>
            <h2>Datei auswählen</h2>
            <p>Excel, CSV oder Text. Trennzeichen, Blatt und Kopfzeile werden erkannt
               und lassen sich umstellen.</p>
          </div>
          <a className="btn klein" href="/api/import/vorlage">Vorlagen herunterladen</a>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="file" onChange={waehlen}
                   accept=".csv,.txt,.xlsx,.xlsm,.xls,text/csv,text/plain" />
            {laeuft === 'analyse' && <span className="muted">Datei wird gelesen …</span>}
          </div>
          {datei && !fehler && (
            <p className="muted" style={{ marginBottom: 0 }}>
              {datei.name} · {zahlF(Math.round(datei.size / 1024))} kB
              {analyse?.zeilen_gelesen != null && <> · {zahlF(analyse.zeilen_gelesen)} Datenzeilen
                · {analyse.format === 'excel' ? `Blatt „${analyse.blatt}“` : `Trennzeichen ${analyse.trennzeichen}`}</>}
            </p>
          )}
        </div>
      </div>

      {/* -------------------------------------------- Schritt 2: Was ist das? */}
      {analyse && !analyse.error && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 2</div>
              <h2>Was ist das für eine Datei?</h2>
              <p>Die Wahl bestimmt, welche Felder es gibt, wohin die Zeilen gehen und
                 auf welcher Seite sie danach auftauchen. Vorgeschlagen wird nur –
                 entschieden wird hier.</p>
            </div>
            {analyse.art_vorschlag && analyse.art_vorschlag !== 'pruefen' && (
              <span className="chip info">
                erkannt: {arten.find(a => a.key === analyse.art_vorschlag)?.label}
              </span>
            )}
          </div>
          <div className="card-body">
            <div className="artwahl">
              {arten.map(a => (
                <button key={a.key} type="button"
                        className={`kachel artkachel ${a.key === art ? 'aktiv' : ''} wirkung-${a.wirkung}`}
                        onClick={() => artWechseln(a.key)} disabled={!!laeuft}>
                  <b>{a.label}</b>
                  <span className="muted">{a.zweck}</span>
                  <span className="artziel">→ {a.seiteLabel}</span>
                </button>
              ))}
            </div>

            {aktuelleArt && (
              <div className={`note ${aktuelleArt.wirkung === 'ergebnis' ? 'warn' : ''}`}
                   style={{ marginTop: 16 }}>
                <b>{aktuelleArt.label}.</b> {aktuelleArt.folge}
                {aktuelleArt.tabelle !== '—' && (
                  <> Abgelegt wird in <span className="mono">{aktuelleArt.tabelle}</span>.</>
                )}
              </div>
            )}

            <div className="form-row form-row--3" style={{ marginTop: 12 }}>
              {analyse.format === 'excel' && (analyse.blaetter?.length ?? 0) > 1 && (
                <div className="form-group">
                  <label htmlFor="blatt">Tabellenblatt</label>
                  <select id="blatt" value={analyse.blatt}
                          onChange={e => neuLesen('blatt', e.target.value)}>
                    {analyse.blaetter!.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="kopfzeile">Überschriften stehen in Zeile</label>
                <input id="kopfzeile" type="number" min={1} value={(analyse.kopfzeile ?? 0) + 1}
                       onChange={e => neuLesen('kopfzeile', Math.max(0, Number(e.target.value) - 1))} />
              </div>
              {(art === 'vergleich' || art === 'buchungen' || art === 'pruefen') && (
                <div className="form-group">
                  <label htmlFor="ausrichtung">Beträge lesen als</label>
                  <select id="ausrichtung" value={ausrichtung}
                          onChange={e => setAusrichtung(e.target.value as typeof ausrichtung)}>
                    <option value="datei">Vorzeichen wie in der Datei</option>
                    <option value="kosten">Kosten – Betrag zählt als Aufwand</option>
                    <option value="erloese">Erlöse – Betrag zählt als Ertrag</option>
                  </select>
                </div>
              )}
              {art === 'angebote' && (
                <div className="form-group">
                  <label htmlFor="nurJahr">Nur Angebotsjahr</label>
                  <input id="nurJahr" value={nurJahr} placeholder="alle Jahre"
                         onChange={e => setNurJahr(e.target.value.replace(/\D/g, ''))} />
                </div>
              )}
              {art === 'angebote' && (
                <div className="form-group">
                  <label htmlFor="anlegen">Gewonnene Angebote</label>
                  <select id="anlegen" value={projekteAnlegen ? 'ja' : 'nein'}
                          onChange={e => setProjekteAnlegen(e.target.value === 'ja')}>
                    <option value="nein">nur als Chance erfassen</option>
                    <option value="ja">Chance erfassen und Projekt anlegen</option>
                  </select>
                </div>
              )}
              {art === 'vergleich' && (
                <div className="form-group">
                  <label htmlFor="quelle">Bezeichnung der Quelle</label>
                  <input id="quelle" value={quelle} onChange={e => setQuelle(e.target.value)}
                         placeholder="Kostenverfolgung" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------- Schritt 3a: Dateien mit eigenem Leser */}
      {analyse && !analyse.error && aktuelleArt?.eigenerLeser && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 3</div>
              <h2>Nichts zuzuordnen</h2>
              <p>Diese Datei ist keine Tabelle, sondern ein Kalender – je Monat ein Block,
                 je Mitarbeiter mehrere Zeilen. Gelesen wird der Aufbau, nicht die Überschrift.
                 Es gibt deshalb keine Spaltenzuordnung.</p>
            </div>
          </div>
          <div className="card-body">
            <button className="btn primary" disabled={!!laeuft} onClick={() => senden('testlauf')}>
              {laeuft === 'testlauf' ? 'Prüfung läuft …' : 'Prüfen ohne zu speichern'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------- Schritt 3: Felder zuordnen */}
      {analyse && !analyse.error && !!felder.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 3</div>
              <h2>Felder zuordnen</h2>
              <p>Erkannte Spalten sind vorbelegt. Bringt die Datei ein Feld nicht mit,
                 lässt sich rechts ein fester Wert für alle Zeilen setzen.</p>
            </div>
            <span className={`chip ${offen.length ? 'warn' : 'pos'}`}>
              {Object.keys(zuordnung).length} von {kopf.length} Spalten zugeordnet
            </span>
          </div>

          <div className="card-body flush">
            {offen.length > 0 && (
              <div className="note" style={{ margin: '0 16px 12px' }}>
                <b>{offen.map(z => z.label).join(', ')} {offen.length > 1 ? 'sind' : 'ist'} nicht zugeordnet.</b>{' '}
                Der Import läuft trotzdem – Zeilen ohne diese Angabe bleiben liegen und
                stehen mit Grund im Bericht. Nichts hier hält Sie auf.
              </div>
            )}

            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th style={{ width: 220 }}>Feld</th><th style={{ width: 240 }}>Spalte in der Datei</th>
                      <th style={{ width: 190 }}>oder fester Wert</th>
                      <th>Erste Werte aus der Datei</th></tr>
                </thead>
                <tbody>
                  {felder.map(z => {
                    const idx = zuordnung[z.feld];
                    const fest = festwerte[z.feld] ?? '';
                    const leer = z.schluessel && idx === undefined && !fest.trim();
                    return (
                      <tr key={z.feld}>
                        <td>
                          <b>{z.label}</b>
                          {z.schluessel && <span className="chip info" style={{ marginLeft: 6 }}>Schlüssel</span>}
                          {z.empfohlen && <span className="chip" style={{ marginLeft: 6 }}>empfohlen</span>}
                          {z.hinweis && <div className="muted" style={{ fontSize: 11.5 }}>{z.hinweis}</div>}
                        </td>
                        <td>
                          <select value={idx ?? ''} style={{ width: '100%' }}
                                  onChange={e => setzeZuordnung(z.feld, e.target.value)}>
                            <option value="">— nicht zuordnen —</option>
                            {kopf.map((h, i) => (
                              <option key={i} value={i}>{i + 1}. {h || '(ohne Überschrift)'}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input value={fest} disabled={idx !== undefined}
                                 placeholder={idx !== undefined ? 'Spalte gewählt' : '–'}
                                 style={{ width: '100%' }}
                                 onChange={e => setzeFest(z.feld, e.target.value)} />
                        </td>
                        <td className="muted mono" style={{ fontSize: 11.5 }}>
                          {idx !== undefined
                            ? ((analyse.vorschau ?? []).map(r => r[idx]).filter(Boolean).slice(0, 3).join('  ·  ') || '(leer)')
                            : fest.trim() ? `${fest} – für alle Zeilen`
                            : leer ? 'fehlt – betroffene Zeilen bleiben liegen' : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pager">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={merken} onChange={e => setMerken(e.target.checked)} />
                <span className="muted">Zuordnung für diese Spaltenüberschriften merken</span>
              </label>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn" disabled={!!laeuft} onClick={() => artWechseln(art)}>
                  Automatik zurücksetzen
                </button>
                <button className="btn primary" disabled={!!laeuft} onClick={() => senden('testlauf')}>
                  {laeuft === 'testlauf' ? 'Prüfung läuft …' : 'Prüfen ohne zu speichern'}
                </button>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- Schritt 4: Bericht */}
      {bericht && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 4</div>
              <h2>{fehler ? 'Die Datei kann nicht gelesen werden'
                   : bericht.schritt === 'import' ? 'Import abgeschlossen' : 'Prüfbericht'}</h2>
            </div>
            {!fehler && (
              <span className={`chip ${bericht.schritt === 'import' ? 'pos' : 'info'}`}>
                {bericht.schritt === 'import'
                  ? `${zahlF(bericht.importiert)} Zeilen übernommen`
                  : bericht.nur_ansehen ? 'Nur ansehen – es wird nichts geschrieben'
                  : 'Testlauf – nichts geschrieben'}
              </span>
            )}
          </div>

          <div className="card-body">
            {fehler && (
              <div className="note warn">
                <b>{fehler === 'LEERE_DATEI' ? 'Die Datei enthält keine Daten.'
                  : fehler === 'KEINE_SPALTEN' ? 'In der gewählten Kopfzeile steht keine Überschrift.'
                  : fehler === 'DATEI_ZU_GROSS' ? 'Die Datei ist zu groß.'
                  : fehler === 'DATEI_NICHT_LESBAR' ? 'Die Datei lässt sich nicht öffnen.'
                  : fehler === 'FORBIDDEN' ? 'Ihrer Rolle fehlt die Berechtigung import.write.'
                  : fehler === 'NETZWERKFEHLER' ? 'Der Server ist nicht erreichbar.'
                  : fehler}</b>
                {bericht.detail ? <> – {bericht.detail}</> : null}
              </div>
            )}

            {!fehler && (
              <>
                <div className="kpis">
                  {(bericht.kennzahlen ?? []).map(k => (
                    <div className="kpi" key={k.label}>
                      <div className="label">{k.label}</div>
                      <div className="value num">{k.wert}</div>
                      {k.hinweis && <div className="sub">{k.hinweis}</div>}
                    </div>
                  ))}
                </div>

                {!!bericht.zeilen_zusatz && (
                  <div className="note">
                    <b>{zahlF(bericht.zeilen_zusatz)} zusätzliche Buchungen für die
                    Bestandsveränderung.</b> Sie entstehen aus den Schlussrechnungen auf
                    Projekten, die nach Fertigstellungsgrad bewertet werden – Anzahlungen
                    und ausdrücklich abgewählte Zeilen bleiben ohne.
                  </div>
                )}

                {(bericht.unbekannte_auftraege_anzahl || bericht.unbekannte_konten_anzahl) ? (
                  <div className="deflist">
                    {!!bericht.unbekannte_auftraege_anzahl && (
                      <div><b>Unbekannte Aufträge</b>
                        <span>{zahlF(bericht.unbekannte_auftraege_anzahl)} –
                          <span className="mono"> {bericht.unbekannte_auftraege?.join(', ')}</span>.
                          Werden übernommen, laufen aber ohne Projektzuordnung.</span></div>
                    )}
                    {!!bericht.unbekannte_konten_anzahl && (
                      <div><b>Unbekannte Konten</b>
                        <span>{zahlF(bericht.unbekannte_konten_anzahl)} –
                          <span className="mono"> {bericht.unbekannte_konten?.join(', ')}</span>.
                          Werden angelegt und nach Nummernkreis eingeordnet.</span></div>
                    )}
                  </div>
                ) : null}

                {!!bericht.vorschau_saetze?.length && (
                  <>
                    <h3 style={{ fontSize: 13.5, margin: '18px 0 6px' }}>So werden die Zeilen abgelegt</h3>
                    <div className="tablewrap">
                      <table className="data compact">
                        <thead>
                          <tr>{Object.keys(bericht.vorschau_saetze[0])
                            .filter(k => bericht.vorschau_saetze!.some(s => s[k] !== null && s[k] !== ''))
                            .map(k => <th key={k}>{k}</th>)}</tr>
                        </thead>
                        <tbody>
                          {bericht.vorschau_saetze.map((s, i) => {
                            const spalten = Object.keys(bericht.vorschau_saetze![0])
                              .filter(k => bericht.vorschau_saetze!.some(x => x[k] !== null && x[k] !== ''));
                            return (
                              <tr key={i}>{spalten.map(k =>
                                <td key={k} className="mono" style={{ fontSize: 11.5 }}>
                                  {s[k] === null || s[k] === undefined ? '–' : String(s[k])}
                                </td>)}</tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {!!bericht.hinweise?.length && (
                  <>
                    <h3 style={{ fontSize: 13.5, margin: '18px 0 6px' }}>
                      Liegen gebliebene Zeilen ({zahlF(bericht.zeilen_uebersprungen)})
                    </h3>
                    <div className="tablewrap">
                      <table className="data compact">
                        <thead><tr><th style={{ width: 90 }}>Zeile</th><th>Grund</th></tr></thead>
                        <tbody>
                          {bericht.hinweise.map(h => (
                            <tr key={h.zeile}><td className="num">{h.zeile}</td><td className="muted">{h.grund}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {bericht.schritt === 'testlauf' && !bericht.nur_ansehen && (
                  <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn primary" disabled={!!laeuft || !bericht.zeilen_importierbar}
                            onClick={() => senden('import')}>
                      {laeuft === 'import' ? 'Import läuft …'
                        : `${zahlF(bericht.zeilen_importierbar)} Zeilen jetzt importieren`}
                    </button>
                    <span className="muted">
                      {bericht.zeilen_importierbar
                        ? 'Bis hierher wurde nichts gespeichert.'
                        : 'Keine Zeile ist ablegbar – bitte die Zuordnung prüfen.'}
                    </span>
                  </div>
                )}

                {bericht.schritt === 'import' && (
                  <div className="note" style={{ marginTop: 16, marginBottom: 0 }}>
                    Protokolliert unter Lauf-Nummer {bericht.import_id}
                    {aktuelleArt && <> · zu sehen unter <b>{aktuelleArt.seiteLabel}</b></>}.
                    {!!bericht.unbekannte_konten_anzahl &&
                      ' Neue Konten wurden angelegt – bitte im Kostenartenstamm die Bezeichnung pflegen.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
