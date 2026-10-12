'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { eur0, pct, num } from '@/lib/format';
import { standardFuer } from '@/lib/massnahmeStandard';

type Risiko = {
  id: string; bezeichnung: string; kategorie: string; wahrscheinlichkeit: number;
  kosten_min: number; kosten_wahrsch: number; kosten_max: number;
  brutto: number; ziel: number; netto: number;
  massnahmen: number; massnahmen_offen: number;
};
type Massnahme = {
  id: number; risiko_id: string; massnahme: string; ziel_reduktion: number;
  status: string; verantwortlich: string | null; frist: string | null;
};
type Vorschlag = {
  id: number; kategorie: string; massnahme: string; wirkung: string; grundlage: string;
  sortierung?: number;
};
const STATUS = ['offen', 'in Umsetzung', 'erledigt', 'verworfen'];

/* Achsen der Matrix. Die Auswirkungsklassen orientieren sich an der
   Groessenordnung der Abbruchprojekte, nicht an einer generischen Skala. */
const WAHRSCHEINLICHKEIT = [
  { bis: 0.10, text: 'sehr gering', kurz: '≤10 %' },
  { bis: 0.25, text: 'gering',      kurz: '≤25 %' },
  { bis: 0.50, text: 'mittel',      kurz: '≤50 %' },
  { bis: 0.75, text: 'hoch',        kurz: '≤75 %' },
  { bis: 1.01, text: 'sehr hoch',   kurz: '>75 %' },
];
const AUSWIRKUNG = [
  { bis: 25_000,    text: 'gering',    kurz: '≤25 T€' },
  { bis: 100_000,   text: 'spürbar',   kurz: '≤100 T€' },
  { bis: 250_000,   text: 'erheblich', kurz: '≤250 T€' },
  { bis: 500_000,   text: 'schwer',    kurz: '≤500 T€' },
  { bis: Infinity,  text: 'kritisch',  kurz: '>500 T€' },
];

const stufe = (wert: number, skala: { bis: number }[]) =>
  Math.max(0, skala.findIndex(s => wert <= s.bis));

/** Ampel: Produkt aus beiden Stufen, 0-16. */
function ton(w: number, a: number) {
  const s = (w + 1) * (a + 1);
  if (s >= 16) return 'kritisch';
  if (s >= 9)  return 'hoch';
  if (s >= 4)  return 'mittel';
  return 'gering';
}

export default function Risikomatrix({ projektNr, risiken, massnahmen, katalog, schreibrecht }: {
  projektNr: string; risiken: Risiko[]; massnahmen: Massnahme[];
  katalog: Vorschlag[]; schreibrecht: boolean;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null);

  if (!risiken.length) {
    return (
      <div className="card">
        <div className="card-head"><div>
          <div className="eyebrow">Risiko</div><h2>Risikomatrix</h2>
        </div></div>
        <div className="card-body">
          <div className="empty">Für diesen Auftrag ist kein Risiko erfasst.</div>
        </div>
      </div>
    );
  }

  /* Positionierung: Wahrscheinlichkeit auf der einen, der wahrscheinliche
     Kostenwert auf der anderen Achse. Nicht der Erwartungswert – sonst
     stünde die Wahrscheinlichkeit zweimal in derselben Zahl. */
  const platziert = risiken.map(r => ({
    r,
    w: stufe(num(r.wahrscheinlichkeit), WAHRSCHEINLICHKEIT),
    a: stufe(num(r.kosten_wahrsch), AUSWIRKUNG),
  }));

  const brutto = risiken.reduce((s, r) => s + num(r.brutto), 0);
  const ziel   = risiken.reduce((s, r) => s + num(r.ziel), 0);
  const netto  = risiken.reduce((s, r) => s + num(r.netto), 0);

  async function speichern(risiko: Risiko, massnahme: string, reduktion: number) {
    setLaeuft(true); setMeldung(null);
    try {
      const a = await fetch('/api/massnahmen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risiko_id: risiko.id, massnahme, ziel_reduktion: reduktion }),
      });
      const d = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(d.fehler || `Fehler ${a.status}`);
      setMeldung({ text: 'Maßnahme übernommen.' });
      router.refresh();
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  async function aendern(id: number, massnahme: string, reduktion: number, status: string) {
    setLaeuft(true); setMeldung(null);
    try {
      const a = await fetch('/api/massnahmen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, massnahme, ziel_reduktion: reduktion, status }),
      });
      const d = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(d.fehler || `Fehler ${a.status}`);
      setMeldung({ text: 'Maßnahme geändert.' });
      router.refresh();
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  async function entfernen(id: number) {
    setLaeuft(true);
    try {
      const a = await fetch(`/api/massnahmen?id=${id}`, { method: 'DELETE' });
      if (!a.ok) throw new Error((await a.json().catch(() => ({}))).fehler || `Fehler ${a.status}`);
      router.refresh();
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally { setLaeuft(false); }
  }

  return (
    <>
      {meldung && <div className={meldung.fehler ? 'note warn' : 'note'}>{meldung.text}</div>}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Risiko</div>
            <h2>Risikomatrix</h2>
          </div>
        </div>

        <div className="card-body">
          <div className="risiko-kpis">
            <div><span className="l">Brutto-Risiko</span><span className="v num">{eur0(brutto)}</span></div>
            <div><span className="l">Geplante Minderung</span><span className="v num">{eur0(ziel)}</span></div>
            <div><span className="l">Netto-Risiko</span>
                 <span className={`v num ${netto > 0 ? 'neg' : 'pos'}`}>{eur0(netto)}</span></div>
            <div><span className="l">Risiken</span><span className="v num">{risiken.length}</span></div>
          </div>

          <div className="matrixwrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th className="ecke">Auswirkung ↓ / Eintritt →</th>
                  {WAHRSCHEINLICHKEIT.map(w => (
                    <th key={w.text}>{w.text}<div className="kurz">{w.kurz}</div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...AUSWIRKUNG].map((a, ai) => ai).reverse().map(ai => (
                  <tr key={ai}>
                    <th className="zeile">{AUSWIRKUNG[ai].text}<div className="kurz">{AUSWIRKUNG[ai].kurz}</div></th>
                    {WAHRSCHEINLICHKEIT.map((_, wi) => {
                      const drin = platziert.filter(p => p.w === wi && p.a === ai);
                      const summe = drin.reduce((s, p) => s + num(p.r.netto), 0);
                      return (
                        <td key={wi} className={`feld ${ton(wi, ai)} ${drin.length ? 'belegt' : ''}`}>
                          {!!drin.length && (
                            <>
                              <div className="anzahl">{drin.length}</div>
                              <div className="betrag num">{eur0(summe)}</div>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ------------------------------------------- Risiken mit Maßnahmen */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Gegensteuern</div>
            <h2>Risiken und vorgeschlagene Maßnahmen</h2>
          </div>
        </div>
        <div className="card-body flush">
          {risiken.map(r => {
            const eigene = massnahmen.filter(m => m.risiko_id === r.id);
            const vorschlaege = katalog.filter(v => v.kategorie === r.kategorie);
            const auf = offen === r.id;
            return (
              <div key={r.id} className="risikozeile">
                <button type="button" className="risikokopf"
                        onClick={() => setOffen(auf ? null : r.id)} aria-expanded={auf}>
                  <span className="pfeil">{auf ? '▾' : '▸'}</span>
                  <span className="bez">{r.bezeichnung}</span>
                  <span className="chip info">{r.kategorie}</span>
                  <span className="muted">{pct(num(r.wahrscheinlichkeit) * 100)}</span>
                  <span className="num">Brutto {eur0(r.brutto)}</span>
                  {num(r.ziel) > 0 && <span className="chip pos">−{eur0(r.ziel)}</span>}
                  <span className={`num ${num(r.netto) > 0 ? 'neg' : 'pos'}`}><b>Netto {eur0(r.netto)}</b></span>
                </button>

                {auf && (
                  <div className="risikodetail">
                    <div className="dreipunkt">
                      <span>Minimum <b className="num">{eur0(r.kosten_min)}</b></span>
                      <span>wahrscheinlich <b className="num">{eur0(r.kosten_wahrsch)}</b></span>
                      <span>Maximum <b className="num">{eur0(r.kosten_max)}</b></span>
                    </div>

                    <MassnahmeForm risiko={r} eigene={eigene} vorschlaege={vorschlaege}
                                   katalog={katalog} schreibrecht={schreibrecht} laeuft={laeuft}
                                   onNeu={(text, reduktion) => speichern(r, text, reduktion)}
                                   onAendern={aendern} onEntfernen={entfernen} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MassnahmeForm({ risiko, eigene, vorschlaege, katalog, schreibrecht, laeuft,
  onNeu, onAendern, onEntfernen }: {
  risiko: Risiko; eigene: Massnahme[]; vorschlaege: Vorschlag[]; katalog: Vorschlag[];
  schreibrecht: boolean; laeuft: boolean;
  onNeu: (text: string, reduktion: number) => void;
  onAendern: (id: number, text: string, reduktion: number, status: string) => void;
  onEntfernen: (id: number) => void;
}) {
  const standard = standardFuer(risiko.bezeichnung, risiko.kategorie, katalog);
  const [wahl, setWahl] = useState(standard);
  const [eigen, setEigen] = useState('');
  const [proz, setProz] = useState('20');
  const text = wahl || eigen.trim();
  const reduktion = Math.round(num(risiko.brutto) * (Number(proz) || 0) / 100 * 100) / 100;
  const gewaehlt = vorschlaege.find(v => v.massnahme === wahl);

  return (
    <>
      {!!eigene.length && (
        <table className="data compact">
          <thead><tr><th>Übernommene Maßnahme</th><th className="r">Minderung</th>
            <th>Status</th><th /></tr></thead>
          <tbody>
            {eigene.map(m => (
              <Bestehende key={m.id} m={m} vorschlaege={vorschlaege} schreibrecht={schreibrecht}
                          laeuft={laeuft} onAendern={onAendern} onEntfernen={onEntfernen} />
            ))}
          </tbody>
        </table>
      )}

      {schreibrecht && (
        <div className="vorschlaege">
          <div className="ueberschrift">Vorschläge für {risiko.kategorie}</div>
          <div className="vorschlag" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={wahl} onChange={e => setWahl(e.target.value)} aria-label="Maßnahme"
                      style={{ flex: 1, minWidth: 220 }}>
                {vorschlaege.map(v => <option key={v.id} value={v.massnahme}>{v.massnahme}</option>)}
                <option value="">eigene Formulierung …</option>
              </select>
              {!wahl && (
                <input value={eigen} onChange={e => setEigen(e.target.value)}
                       placeholder="Eigene Maßnahme" aria-label="Eigene Maßnahme"
                       style={{ flex: 1, minWidth: 180 }} />
              )}
              <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={0} max={100} value={proz}
                       onChange={e => setProz(e.target.value)} aria-label="Minderung in Prozent"
                       style={{ width: 72 }} /> %
              </label>
            </div>
            <button className="btn" disabled={laeuft || !text}
                    onClick={() => onNeu(text, reduktion)}>übernehmen</button>
          </div>
          {gewaehlt && <div className="muted" style={{ fontSize: 12.5 }}>{gewaehlt.wirkung}</div>}
        </div>
      )}
    </>
  );
}

function Bestehende({ m, vorschlaege, schreibrecht, laeuft, onAendern, onEntfernen }: {
  m: Massnahme; vorschlaege: Vorschlag[]; schreibrecht: boolean; laeuft: boolean;
  onAendern: (id: number, text: string, reduktion: number, status: string) => void;
  onEntfernen: (id: number) => void;
}) {
  const bekannt = vorschlaege.some(v => v.massnahme === m.massnahme);
  const [wahl, setWahl] = useState(bekannt ? m.massnahme : '');
  const [eigen, setEigen] = useState(bekannt ? '' : m.massnahme);
  const [betrag, setBetrag] = useState(String(num(m.ziel_reduktion)));
  const [status, setStatus] = useState(m.status);
  const text = wahl || eigen.trim();

  return (
    <tr>
      <td>
        {schreibrecht ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select value={wahl} onChange={e => setWahl(e.target.value)} aria-label="Maßnahme ändern">
              {vorschlaege.map(v => <option key={v.id} value={v.massnahme}>{v.massnahme}</option>)}
              <option value="">eigene Formulierung …</option>
            </select>
            {!wahl && (
              <input value={eigen} onChange={e => setEigen(e.target.value)} aria-label="Eigene Maßnahme" />
            )}
          </div>
        ) : m.massnahme}
      </td>
      <td className="r num">
        {schreibrecht
          ? <input type="number" min={0} value={betrag} onChange={e => setBetrag(e.target.value)}
                   aria-label="Minderung in Euro" style={{ width: 110, textAlign: 'right' }} />
          : eur0(m.ziel_reduktion)}
      </td>
      <td>
        {schreibrecht ? (
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : <span className="chip info">{m.status}</span>}
      </td>
      <td className="r">
        {schreibrecht && (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button className="btn klein" disabled={laeuft || !text}
                    onClick={() => onAendern(m.id, text, Number(betrag) || 0, status)}>speichern</button>
            <button className="btn klein" disabled={laeuft}
                    onClick={() => onEntfernen(m.id)}>entfernen</button>
          </span>
        )}
      </td>
    </tr>
  );
}
