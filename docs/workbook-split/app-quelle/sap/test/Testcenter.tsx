'use client';

/**
 * Testcenter der Buchungsautomatik.
 *
 * Hier laesst sich durchspielen, was die Buchungsmaske automatisch ergaenzen
 * wuerde – ohne dass ein Beleg entsteht.  Zwei Automatiken laufen mit:
 * die Bestandsveraenderung bei Projekten mit Bewertung nach
 * Fertigstellungsgrad und die Gemeinkostenumlage der Region.
 *
 * Gerechnet wird ueber dieselbe Schnittstelle wie in der Maske, damit beide
 * nie auseinanderlaufen koennen.
 */

import { useEffect, useState, useCallback } from 'react';

type Zeile = { buchungsschluessel: string; konto: string; betrag: string; auftrag: string; text: string };

type Antwort = {
  einstellung: { kontoBestand: string; kontoGuv: string; automatik: boolean };
  umlageEinstellung: { konto: string; satz: number; automatik: boolean;
                       kostenstelle: string; belegkreis: string; angewendet: boolean };
  umlage: {
    auftrag: string; basis: number; satz: number; betrag: number;
    kostenstelle: string; erklaerung: string;
    zeilen: { buchungsschluessel: string; konto: string; betrag: number;
              kostenstelle?: string; text?: string }[];
  }[];
  auftraege: { auftrag: string; hatBv: boolean; projektname: string | null }[];
  vorschlaege: {
    auftrag: string; projektname: string; grundlage: number;
    richtung: 'AUFBAU' | 'ABBAU'; erklaerung: string;
    zeilen: { buchungsschluessel: string; konto: string; betrag: number; text?: string }[];
  }[];
  probeVorher: { soll: number; haben: number; differenz: number };
  probeNachher: { soll: number; haben: number; differenz: number };
  testbeleg: {
    kopf: Record<string, string>;
    zeilen: { buchungsschluessel: string; konto: string; betrag: number;
              auftrag?: string; text?: string }[];
    csv: string; gespeichert: boolean;
  };
};

const eur = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(v || 0) + ' €';

const SCHLUESSEL = [
  ['40', '40 · Sachkonto Soll'], ['50', '50 · Sachkonto Haben'],
  ['31', '31 · Rechnung Kreditor'], ['01', '01 · Rechnung Debitor'],
] as const;

const LEER: Zeile = { buchungsschluessel: '40', konto: '', betrag: '', auftrag: '', text: '' };

export default function Testcenter({ beispiele }: {
  beispiele: { nr: string; name: string; hatBv: boolean }[];
}) {
  const mitBv = beispiele.filter(b => b.hatBv);
  const ohneBv = beispiele.filter(b => !b.hatBv);

  const [zeilen, setZeilen] = useState<Zeile[]>([
    { buchungsschluessel: '40', konto: '300075', betrag: '50000',
      auftrag: mitBv[0]?.nr ?? '', text: 'Materialaufwand Abbruch' },
    { buchungsschluessel: '31', konto: '160000', betrag: '50000',
      auftrag: '', text: 'Kreditorenrechnung' },
  ]);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /* Leer heisst: Satz aus den Einstellungen.  Im Bestand kommen 12 % und
     5 % vor, deshalb laesst er sich hier setzen statt raten. */
  const [umlagesatz, setUmlagesatz] = useState('');
  const [umlageAn, setUmlageAn] = useState(true);

  const rechnen = useCallback(async (zs: Zeile[], satz: string, an: boolean) => {
    setLaeuft(true);
    try {
      const r = await fetch('/api/bestandsveraenderung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zeilen: zs, umlagesatz: satz, umlage: an }),
      });
      setAntwort(r.ok ? await r.json() : null);
    } catch { setAntwort(null); } finally { setLaeuft(false); }
  }, []);

  useEffect(() => { rechnen(zeilen, umlagesatz, umlageAn); },
            [zeilen, umlagesatz, umlageAn, rechnen]);

  const setzen = (i: number, k: keyof Zeile, v: string) =>
    setZeilen(zs => zs.map((z, j) => j === i ? { ...z, [k]: v } : z));

  const beispielLaden = (art: 'aufbau' | 'abbau' | 'ohne') => {
    const mit = mitBv[0]?.nr ?? '';
    const ohne = ohneBv[0]?.nr ?? '';
    if (art === 'aufbau') setZeilen([
      { buchungsschluessel: '40', konto: '300075', betrag: '50000', auftrag: mit, text: 'Materialaufwand Abbruch' },
      { buchungsschluessel: '31', konto: '160000', betrag: '50000', auftrag: '', text: 'Kreditorenrechnung' },
    ]);
    if (art === 'abbau') setZeilen([
      { buchungsschluessel: '01', konto: '140000', betrag: '120000', auftrag: '', text: 'Abschlagsrechnung' },
      { buchungsschluessel: '50', konto: '830510', betrag: '120000', auftrag: mit, text: 'Erlöse Abriss' },
    ]);
    if (art === 'ohne') setZeilen([
      { buchungsschluessel: '40', konto: '300075', betrag: '50000', auftrag: ohne, text: 'Materialaufwand' },
      { buchungsschluessel: '31', konto: '160000', betrag: '50000', auftrag: '', text: 'Kreditorenrechnung' },
    ]);
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schritt 1</div>
            <h2>Beleg erfassen</h2>
            <p>Tippen Sie einen Beleg wie in der Buchungsmaske. Was die Maske automatisch
               ergänzen würde, erscheint darunter — gebucht wird hier nichts.</p>
          </div>
          <div className="btn-group">
            <button type="button" className="btn klein" onClick={() => beispielLaden('aufbau')}>
              Beispiel: Kosten
            </button>
            <button type="button" className="btn klein" onClick={() => beispielLaden('abbau')}>
              Beispiel: Erlöse
            </button>
            <button type="button" className="btn klein" onClick={() => beispielLaden('ohne')}>
              Beispiel: Auftrag ohne BV
            </button>
          </div>
        </div>

        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>Buchungsschlüssel</th>
                  <th style={{ width: 110 }}>Konto</th>
                  <th style={{ width: 130 }} className="r">Betrag</th>
                  <th style={{ width: 190 }}>Auftrag</th>
                  <th>Text</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z, i) => (
                  <tr key={i}>
                    <td>
                      <select value={z.buchungsschluessel} style={{ width: '100%' }}
                              onChange={e => setzen(i, 'buchungsschluessel', e.target.value)}>
                        {SCHLUESSEL.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
                      </select>
                    </td>
                    <td><input value={z.konto} style={{ width: '100%' }}
                               onChange={e => setzen(i, 'konto', e.target.value)} /></td>
                    <td><input value={z.betrag} inputMode="decimal" className="r"
                               style={{ width: '100%', textAlign: 'right' }}
                               onChange={e => setzen(i, 'betrag', e.target.value)} /></td>
                    <td>
                      <select value={z.auftrag} style={{ width: '100%' }}
                              onChange={e => setzen(i, 'auftrag', e.target.value)}>
                        <option value="">— ohne Auftrag —</option>
                        <optgroup label="mit Bestandsveränderung">
                          {mitBv.slice(0, 40).map(b => (
                            <option key={b.nr} value={b.nr}>{b.nr} · {b.name.slice(0, 28)}</option>
                          ))}
                        </optgroup>
                        <optgroup label="ohne Bestandsveränderung">
                          {ohneBv.slice(0, 40).map(b => (
                            <option key={b.nr} value={b.nr}>{b.nr} · {b.name.slice(0, 28)}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td><input value={z.text} style={{ width: '100%' }}
                               onChange={e => setzen(i, 'text', e.target.value)} /></td>
                    <td className="r">
                      {zeilen.length > 2 && (
                        <button type="button" className="btn klein"
                                onClick={() => setZeilen(zs => zs.filter((_, j) => j !== i))}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted">
              {antwort && (
                <>Erfasst: Soll {eur(antwort.probeVorher.soll)} · Haben {eur(antwort.probeVorher.haben)}
                  {antwort.probeVorher.differenz !== 0 && (
                    <> · <b className="neg">Differenz {eur(antwort.probeVorher.differenz)}</b></>
                  )}
                </>
              )}
            </span>
            <button type="button" className="btn"
                    onClick={() => setZeilen(zs => [...zs, { ...LEER }])}>Zeile hinzufügen</button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ Ergebnis */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schritt 2</div>
            <h2>Was die Maske ergänzen würde</h2>
          </div>
          <span className={`chip ${(antwort?.vorschlaege.length ?? 0) + (antwort?.umlage.length ?? 0) ? 'pos' : ''}`}>
            {laeuft ? 'rechnet …' : (() => {
              const n = (antwort?.vorschlaege.length ?? 0) + (antwort?.umlage.length ?? 0);
              return `${n} Buchungssatz${n === 1 ? '' : 'e'}`;
            })()}
          </span>
        </div>

        <div className="card-body">
          {antwort?.auftraege.length ? (
            <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
              Erfasste Aufträge:{' '}
              {antwort.auftraege.map((a, i) => (
                <span key={a.auftrag}>
                  {i > 0 && ' · '}
                  <span className="mono">{a.auftrag}</span>{' '}
                  <span className={`chip ${a.hatBv ? 'pos' : ''}`} style={{ fontSize: 10 }}>
                    {a.hatBv ? 'mit Bestandsveränderung' : 'ohne'}
                  </span>
                </span>
              ))}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Noch kein Auftrag erfasst.</p>
          )}
        </div>

        {antwort?.vorschlaege.length ? (
          <div className="card-body flush">
            {antwort.vorschlaege.map(v => (
              <div key={v.auftrag} style={{ borderTop: '1px solid var(--linie, #e5e7eb)' }}>
                <div className="card-body" style={{ paddingBottom: 6 }}>
                  <b>{v.auftrag} · {v.projektname}</b>
                  <span className={`chip ${v.richtung === 'AUFBAU' ? 'pos' : 'warn'}`}
                        style={{ marginLeft: 8 }}>
                    {v.richtung === 'AUFBAU' ? 'Bestandsaufbau' : 'Bestandsabbau'}
                  </span>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>{v.erklaerung}</p>
                </div>
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th>Schlüssel</th><th>Konto</th><th className="r">Soll</th>
                          <th className="r">Haben</th><th>Text</th></tr>
                    </thead>
                    <tbody>
                      {v.zeilen.map((z, i) => {
                        const soll = ['01', '21', '40', '70'].includes(z.buchungsschluessel);
                        return (
                          <tr key={i}>
                            <td className="mono">{z.buchungsschluessel}</td>
                            <td className="mono">{z.konto}</td>
                            <td className="r num">{soll ? eur(z.betrag) : ''}</td>
                            <td className="r num">{soll ? '' : eur(z.betrag)}</td>
                            <td className="muted">{z.text}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* --------------------------------------- Gemeinkostenumlage */}
        <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="form-row form-row--3">
            <div className="form-group">
              <label htmlFor="umlage">Gemeinkostenumlage</label>
              <select id="umlage" value={umlageAn ? 'ja' : 'nein'}
                      onChange={e => setUmlageAn(e.target.value === 'ja')}>
                <option value="ja">mitrechnen</option>
                <option value="nein">weglassen</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="satz">Zuschlagssatz %</label>
              <input id="satz" value={umlagesatz} disabled={!umlageAn}
                     placeholder={`${antwort?.umlageEinstellung.satz ?? 12} (Einstellung)`}
                     onChange={e => setUmlagesatz(e.target.value.replace(/[^0-9,.]/g, ''))} />
            </div>
            <div className="form-group">
              <label>Konto und Gegenstelle</label>
              <input readOnly value={
                antwort ? `${antwort.umlageEinstellung.konto} · ${antwort.umlageEinstellung.kostenstelle}` : ''} />
            </div>
          </div>

          {umlageAn && !antwort?.umlage.length && (
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Kein Zuschlag: der Beleg trägt auf keinem Auftrag Kosten, oder die Umlage
              steht schon darin.
            </p>
          )}
        </div>

        {antwort?.umlage.length ? (
          <div className="card-body flush">
            {antwort.umlage.map(v => (
              <div key={v.auftrag} style={{ borderTop: '1px solid var(--border)' }}>
                <div className="card-body" style={{ paddingBottom: 6 }}>
                  <b>{v.auftrag}</b>
                  <span className="chip info" style={{ marginLeft: 8 }}>
                    Umlage {v.satz.toLocaleString('de-DE')} %
                  </span>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: 12.5 }}>{v.erklaerung}</p>
                </div>
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th>Schlüssel</th><th>Konto</th><th>Auftrag / Kostenstelle</th>
                          <th className="r">Soll</th><th className="r">Haben</th><th>Text</th></tr>
                    </thead>
                    <tbody>
                      {v.zeilen.map((z, i) => {
                        const soll = ['01', '21', '40', '70'].includes(z.buchungsschluessel);
                        return (
                          <tr key={i}>
                            <td className="mono">{z.buchungsschluessel}</td>
                            <td className="mono">{z.konto}</td>
                            <td className="mono">{soll ? v.auftrag : (z.kostenstelle ?? '')}</td>
                            <td className="r num">{soll ? eur(z.betrag) : ''}</td>
                            <td className="r num">{soll ? '' : eur(z.betrag)}</td>
                            <td className="muted">{z.text}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {antwort && (
          <div className="card-body">
            <div className={`note ${antwort.probeNachher.differenz === 0 ? '' : 'warn'}`}>
              <b>Belegprobe.</b> Nach dem Ergänzen: Soll {eur(antwort.probeNachher.soll)},
              Haben {eur(antwort.probeNachher.haben)},{' '}
              {antwort.probeNachher.differenz === 0
                ? <b>Differenz 0,00 € — der Beleg ist ausgeglichen.</b>
                : <b className="neg">Differenz {eur(antwort.probeNachher.differenz)}</b>}
              <br />
              Konten laut Einstellungen: Bestand{' '}
              <span className="mono">{antwort.einstellung.kontoBestand}</span>, Bestandsveränderung{' '}
              <span className="mono">{antwort.einstellung.kontoGuv}</span>, Umlage{' '}
              <span className="mono">{antwort.umlageEinstellung.konto}</span>.
              {' '}Die Umlage ist ein geschlossener Kreis — Belastung des Auftrags und
              Entlastung der Kostenstelle heben sich auf, am Ergebnis der Gesellschaft
              ändert sie nichts.
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ Testbeleg */}
      {antwort?.testbeleg && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Schritt 3</div>
              <h2>Der fertige Beleg</h2>
              <p>So sähe der Beleg aus, den SAP bekäme — mit den ergänzten Zeilen.</p>
            </div>
            <div className="btn-group">
              <span className="chip neg">nicht gebucht</span>
              <button type="button" className="btn klein" onClick={() => {
                const b = new Blob([antwort.testbeleg.csv], { type: 'text/csv;charset=utf-8' });
                const u = URL.createObjectURL(b);
                const a = document.createElement('a');
                a.href = u; a.download = 'TESTBELEG_nicht_gebucht.csv';
                document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
              }}>Als CSV ansehen</button>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th style={{ width: 60 }}>Pos.</th><th style={{ width: 90 }}>Schlüssel</th>
                      <th style={{ width: 100 }}>Konto</th><th className="r">Soll</th>
                      <th className="r">Haben</th><th>Auftrag</th><th>Text</th></tr>
                </thead>
                <tbody>
                  {antwort.testbeleg.zeilen.map((z, i) => {
                    const soll = ['01', '21', '40', '70'].includes(z.buchungsschluessel);
                    const ergaenzt = i >= antwort.testbeleg.zeilen.length
                      - antwort.vorschlaege.reduce((a, v) => a + v.zeilen.length, 0);
                    return (
                      <tr key={i} style={ergaenzt ? { background: '#F2F7EF' } : undefined}>
                        <td className="num muted">{i + 1}</td>
                        <td className="mono">{z.buchungsschluessel}</td>
                        <td className="mono">{z.konto}</td>
                        <td className="r num">{soll ? eur(z.betrag) : ''}</td>
                        <td className="r num">{soll ? '' : eur(z.betrag)}</td>
                        <td className="mono muted">{z.auftrag}</td>
                        <td className="muted">
                          {z.text}
                          {ergaenzt && <span className="chip pos" style={{ marginLeft: 6, fontSize: 10 }}>
                            automatisch
                          </span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-body">
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
              Belegnummer <span className="mono">{antwort.testbeleg.kopf.belegnummer}</span> ·
              Buchungskreis <span className="mono">{antwort.testbeleg.kopf.buchungskreis}</span> ·
              Belegart <span className="mono">{antwort.testbeleg.kopf.belegart}</span> ·
              gespeichert: <b>nein</b>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
